import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareTestDb } from './test-db.js';
import type {
  RequestRecord,
  Service,
  User,
  WorkOrder,
  Appointment,
  PageData,
} from '../frontend/src/services/types.js';
test('DRIVECORE: full lifecycle, persistence, permissions and concurrency', async (t) => {
  await prepareTestDb();
  const { app } = await import('../backend/src/app.js');
  const { db } = await import('../backend/src/utils/db.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const base = `http://127.0.0.1:${address.port}/api`;
  async function mutationHeaders(cookie = '') {
    const response = await fetch(base + '/auth/csrf', { headers: cookie ? { Cookie: cookie } : {} });
    const { token } = await response.json() as { token: string };
    const csrfCookie = response.headers.getSetCookie().find((c) => c.startsWith('drivecore_csrf='))!.split(';')[0];
    return { Cookie: [cookie, csrfCookie].filter(Boolean).join('; '), 'X-CSRF-Token': token };
  }
  let adminCookie = '',
    mechanicCookie = '',
    managerCookie = '';
  async function call<T>(
    path: string,
    body?: unknown,
    method = body ? 'POST' : 'GET',
    cookie = adminCookie,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? await mutationHeaders(cookie) : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json()) as T;
    return {
      status: response.status,
      data,
      cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    };
  }
  let service: Service,
    mechanic: User,
    otherMechanic: User,
    requestId: number,
    clientId: string,
    orderId: number;
  try {
    await t.test('CRM authorization and password validation', async () => {
      assert.equal((await call('/requests', undefined, 'GET', '')).status, 401);
      assert.equal(
        (
          await call('/auth/login', {
            email: process.env.SEED_ADMIN_EMAIL,
            password: 'invalid',
          })
        ).status,
        401,
      );
      const login = await call<User>('/auth/login', {
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
      assert.equal(login.status, 200);
      adminCookie = login.cookie;
      assert.ok(adminCookie);
      const users = (await call<User[]>('/users')).data;
      mechanic = users.find((u) => u.role === 'MECHANIC')!;
      otherMechanic = users.find((u) => u.role === 'MECHANIC' && u.id !== mechanic.id)!;
      mechanicCookie = (
        await call('/auth/login', {
          email: mechanic.email,
          password: process.env.TEST_STAFF_PASSWORD,
        })
      ).cookie;
      const manager = users.find((u) => u.role === 'MANAGER')!;
      managerCookie = (
        await call('/auth/login', {
          email: manager.email,
          password: process.env.TEST_STAFF_PASSWORD,
        })
      ).cookie;
      service = (await call<Service[]>('/services')).data.find(
        (s) => s.name === 'Тормозная система',
      )!;
      assert.ok(service);
    });
    await t.test('Public form creates linked PostgreSQL records and notification', async () => {
      const result = await call<{ id: number }>(
        '/requests',
        {
          name: 'Александр Тест',
          phone: '+79990000000',
          carBrand: 'BMW',
          carModel: '320i',
          year: 2021,
          licensePlate: 'А123АА77',
          mileage: 64000,
          serviceId: service.id,
          preferredDate: '2026-10-05',
          comment: 'Скрип при торможении',
          source: 'manual',
        },
        'POST',
        '',
      );
      assert.equal(result.status, 201);
      requestId = result.data.id;
      const record = (await call<RequestRecord>(`/requests/${requestId}`)).data;
      assert.equal(record.source, 'website');
      assert.equal(record.status, 'NEW');
      assert.equal(record.car.mileage, 64000);
      assert.equal(record.client.phone, '+79990000000');
      clientId = record.client.id;
      assert.equal(record.activities?.length, 1);
      const notification = await call<{ unread: number }>('/notifications');
      assert.equal(notification.data.unread, 1);
      assert.equal(
        (await call(`/requests/${requestId}`, undefined, 'GET', mechanicCookie)).status,
        403,
      );
    });
    await t.test('Backend rejects missing fields, invalid dates and negative values', async () => {
      assert.equal((await call('/requests', { name: '', phone: 'bad' }, 'POST', '')).status, 400);
      assert.equal(
        (
          await call(
            '/requests',
            {
              name: 'Тест',
              phone: '+79990000000',
              carBrand: 'BMW',
              carModel: '320i',
              serviceId: service.id,
              preferredDate: '2026-02-31',
              mileage: -1,
            },
            'POST',
            '',
          )
        ).status,
        400,
      );
      assert.equal(
        (await call(`/requests/${requestId}`, { status: 'SCHEDULED' }, 'PATCH')).status,
        400,
      );
    });
    await t.test(
      'Schedule appears in calendar; overlapping requests cannot double-book',
      async () => {
        assert.equal(
          (await call(`/requests/${requestId}`, { status: 'CONTACTED' }, 'PATCH')).status,
          200,
        );
        const schedule = {
          requestId,
          mechanicId: mechanic.id,
          startsAt: '2026-10-05T07:00:00Z',
          endsAt: '2026-10-05T08:30:00Z',
        };
        assert.equal((await call('/appointments', schedule)).status, 201);
        const calendar = await call<Appointment[]>('/appointments');
        assert.equal(calendar.data.length, 1);
        assert.equal(calendar.data[0].request.status, 'SCHEDULED');
        const second = (
          await call<RequestRecord>('/requests', {
            name: 'Александр Тест',
            phone: '+79990000000',
            carBrand: 'BMW',
            carModel: '320i',
            serviceId: service.id,
          })
        ).data;
        assert.equal(
          (await call('/appointments', { ...schedule, requestId: second.id })).status,
          409,
        );
        const third = (
          await call<RequestRecord>('/requests', {
            name: 'Второй клиент',
            phone: '+79991110000',
            carBrand: 'Kia',
            carModel: 'K5',
            serviceId: service.id,
          })
        ).data;
        const competing = await Promise.all([
          call('/appointments', {
            ...schedule,
            requestId: second.id,
            mechanicId: otherMechanic.id,
          }),
          call('/appointments', {
            ...schedule,
            requestId: third.id,
            mechanicId: otherMechanic.id,
          }),
        ]);
        assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
        assert.equal(await db.client.count(), 2);
        assert.equal(await db.car.count(), 2);
      },
    );
    await t.test(
      'Mechanic sees own requests and can comment and change allowed statuses',
      async () => {
        const mine = (
          await call<PageData<RequestRecord>>('/requests', undefined, 'GET', mechanicCookie)
        ).data;
        assert.equal(mine.items.length, 1);
        assert.equal(
          (
            await call(
              `/requests/${requestId}`,
              { comment: 'unauthorized' },
              'PATCH',
              mechanicCookie,
            )
          ).status,
          403,
        );
        assert.equal((await call('/clients', undefined, 'GET', mechanicCookie)).status, 403);
        assert.equal(
          (
            await call(
              '/payments',
              { workOrderId: 1, amount: 1, method: 'CARD' },
              'POST',
              mechanicCookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call(`/requests/${requestId}`, { status: 'IN_PROGRESS' }, 'PATCH', mechanicCookie))
            .status,
          200,
        );
        assert.equal(
          (
            await call(
              `/requests/${requestId}/comments`,
              { text: 'Диагностика завершена' },
              'POST',
              mechanicCookie,
            )
          ).status,
          201,
        );
        assert.equal(
          (await call(`/requests/${requestId}`, { status: 'COMPLETED' }, 'PATCH', mechanicCookie))
            .status,
          403,
        );
      },
    );
    await t.test(
      'Work order computes labor + parts exactly; partial payment and concurrency are safe',
      async () => {
        const order = await call<WorkOrder>('/work-orders', { requestId });
        assert.equal(order.status, 201);
        orderId = order.data.id;
        assert.equal(
          (
            await call(
              `/work-orders/${orderId}/items`,
              {
                items: [
                  {
                    kind: 'LABOR',
                    name: 'Замена передних тормозных колодок',
                    quantity: 1,
                    price: 3500,
                  },
                  {
                    kind: 'PART',
                    name: 'Колодки Brembo',
                    quantity: 1,
                    price: 8500,
                  },
                ],
              },
              'PUT',
            )
          ).status,
          200,
        );
        assert.equal(Number((await call<WorkOrder>(`/work-orders/${orderId}`)).data.total), 12000);
        assert.equal(
          (
            await call('/payments', {
              workOrderId: orderId,
              amount: -1,
              method: 'CASH',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call('/payments', {
              workOrderId: orderId,
              amount: 4000,
              method: 'CARD',
            })
          ).status,
          201,
        );
        assert.equal(
          (await call(`/requests/${requestId}`, { status: 'COMPLETED' }, 'PATCH')).status,
          400,
        );
        assert.equal(
          (
            await call('/payments', {
              workOrderId: orderId,
              amount: 8001,
              method: 'CARD',
            })
          ).status,
          400,
        );
        assert.equal(
          (await call(`/work-orders/${orderId}/items`, { items: [] }, 'PUT')).status,
          400,
        );
        const competing = await Promise.all([
          call('/payments', {
            workOrderId: orderId,
            amount: 8000,
            method: 'CARD',
          }),
          call('/payments', {
            workOrderId: orderId,
            amount: 8000,
            method: 'CASH',
          }),
        ]);
        assert.deepEqual(competing.map((r) => r.status).sort(), [201, 400]);
        const final = (await call<WorkOrder>(`/work-orders/${orderId}`)).data;
        assert.equal(
          final.payments.reduce((s, p) => s + Number(p.amount), 0),
          12000,
        );
      },
    );
    await t.test('Completion retains client/car history, tasks, logs and analytics', async () => {
      assert.equal(
        (await call(`/requests/${requestId}`, { status: 'READY' }, 'PATCH', mechanicCookie)).status,
        200,
      );
      assert.equal(
        (await call(`/requests/${requestId}`, { status: 'COMPLETED' }, 'PATCH')).status,
        200,
      );
      const record = (await call<RequestRecord>(`/requests/${requestId}`)).data;
      assert.equal(record.workOrder?.status, 'COMPLETED');
      assert.ok((record.activities?.length || 0) >= 9);
      const history = await call<{ requests: RequestRecord[] }>(`/clients/${clientId}`);
      assert.equal(history.data.requests.find((r) => r.id === requestId)?.status, 'COMPLETED');
      const analytics = await call<{ revenue: number }>('/analytics');
      assert.equal(analytics.data.revenue, 12000);
      const freshDb = (await import('@prisma/client')).PrismaClient;
      const fresh = new freshDb();
      assert.equal(
        (await fresh.request.findUnique({ where: { id: requestId } }))?.status,
        'COMPLETED',
      );
      await fresh.$disconnect();
      assert.equal((await call('/search?q=А123АА77')).status, 200);
    });
    await t.test('Tasks enforce the assignee and persist status', async () => {
      const task = await call<{ id: string }>(`/requests/${requestId}/tasks`, {
        title: 'Проверить тормоза после ремонта',
        assigneeId: mechanic.id,
        dueAt: '2026-10-05T12:00:00+03:00',
      });
      assert.equal(task.status, 201);
      assert.equal(
        (await call(`/tasks/${task.data.id}`, { status: 'DONE' }, 'PATCH', mechanicCookie)).status,
        200,
      );
      assert.equal((await db.task.findUnique({ where: { id: task.data.id } }))?.status, 'DONE');
      const foreignTask = await call<{ id: string }>(`/requests/${requestId}/tasks`, {
        title: 'Задача другого сотрудника',
        assigneeId: otherMechanic.id,
        dueAt: '2026-10-05T12:00:00+03:00',
      });
      assert.equal(
        (await call(`/tasks/${foreignTask.data.id}`, { status: 'DONE' }, 'PATCH', mechanicCookie))
          .status,
        403,
      );
    });
    await t.test('Multipart photos, protected downloads and MIME verification', async () => {
      const photo = readFileSync('public-site/assets/brakes.webp');
      const form = new FormData();
      form.append('files', new Blob([photo], { type: 'image/webp' }), 'repair.webp');
      const uploaded = await fetch(`${base}/requests/${requestId}/files`, {
        method: 'POST',
        headers: { ...await mutationHeaders(mechanicCookie), Origin: 'http://localhost:5173' },
        body: form,
      });
      assert.equal(uploaded.status, 201);
      const file = await db.file.findFirstOrThrow({ where: { requestId } });
      assert.equal(file.fileSize, photo.length);
      const anonymous = await fetch(`${base}/files/${file.id}/download`);
      assert.equal(anonymous.status, 401);
      const downloaded = await fetch(`${base}/files/${file.id}/download`, {
        headers: { Cookie: mechanicCookie },
      });
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), photo);
      const bad = new FormData();
      bad.append('files', new Blob(['This is not an image'], { type: 'image/jpeg' }), 'fake.jpg');
      assert.equal(
        (
          await fetch(`${base}/requests/${requestId}/files`, {
            method: 'POST',
            headers: await mutationHeaders(adminCookie),
            body: bad,
          })
        ).status,
        400,
      );
      assert.equal(await db.file.count({ where: { requestId } }), 1);
      const publicForm = new FormData();
      for (const [key, value] of Object.entries({
        name: 'Фото Тест',
        phone: '+79990000002',
        carBrand: 'BMW',
        carModel: '320i',
        service: 'Замена тормозных колодок',
        preferredDate: '2026-10-05',
      }))
        publicForm.append(key, value);
      publicForm.append('files', new Blob([photo], { type: 'image/webp' }), 'brakes.webp');
      const publicResult = await fetch(`${base}/requests`, { method: 'POST', headers: await mutationHeaders(), body: publicForm });
      assert.equal(publicResult.status, 201);
      const publicRecord = (await publicResult.json()) as { id: number };
      const saved = await db.request.findUniqueOrThrow({
        where: { id: publicRecord.id },
        include: { files: true },
      });
      assert.equal(saved.serviceId, service.id);
      assert.equal(saved.files.length, 1);
      assert.equal(saved.source, 'website');
    });
    await t.test(
      'Administrative configuration, negative prices, origin and JSON validation',
      async () => {
        assert.equal(
          (
            await call(
              '/users',
              {
                name: 'Denied',
                email: 'denied@example.test',
                password: 'invalid-password',
                role: 'ADMIN',
              },
              'POST',
              managerCookie,
            )
          ).status,
          403,
        );
        assert.equal((await call(`/services/${service.id}`, { price: -10 }, 'PATCH')).status, 400);
        const settings = {
          name: 'DRIVECORE',
          phone: '+7 (495) 123-45-67',
          address: 'Тестовый адрес',
          hours: 'Ежедневно 09:00–21:00',
          email: 'info@drivecore.local',
        };
        assert.equal((await call('/settings', settings, 'PATCH', managerCookie)).status, 403);
        assert.equal((await call('/settings', settings, 'PATCH')).status, 200);
        assert.equal(
          (await call<{ address: string }>('/settings', undefined, 'GET', '')).data.address,
          settings.address,
        );
        assert.equal(
          (
            await fetch(`${base}/requests`, {
              method: 'POST',
              headers: {
                Origin: 'https://untrusted.example',
                'Content-Type': 'application/json',
                Cookie: adminCookie,
              },
              body: '{}',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(`${base}/requests`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{',
            })
          ).status,
          400,
        );
        assert.equal((await call('/requests?page=1.5&limit=2.5')).status, 200);
        const calendar = await call<Appointment[]>(
          '/appointments?from=2026-10-04T21:00:00Z&to=2026-10-05T21:00:00Z',
        );
        assert.equal(calendar.status, 200);
        const appointments = calendar.data;
        assert.ok(
          appointments.some((a) => a.requestId === requestId),
          'Completed repair remains in calendar history',
        );
      },
    );
    await t.test('Security regressions: CSRF, dates, byte limits, upload bounds and alerts', async () => {
      const { readdirSync } = await import('node:fs');
      assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: adminCookie } })).status, 403);
      assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { ...await mutationHeaders(adminCookie), 'X-CSRF-Token': 'é'.repeat(43) } })).status, 403);
      assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { ...await mutationHeaders(adminCookie), Referer: 'https://untrusted.example/form' } })).status, 403);
      assert.equal((await call('/appointments?from=2026-10-05T10:00:00%2B99:99')).status, 400);
      assert.equal((await call(`/requests/${requestId}/tasks`, { title: 'Invalid offset', assigneeId: mechanic.id, dueAt: '2026-10-05T10:00:00+03:99' })).status, 400);
      assert.equal((await call('/users', { name: 'Long password', email: 'long@example.test', role: 'MANAGER', password: 'a'.repeat(73) })).status, 400);
      assert.equal((await call('/users', { name: 'Unicode password', email: 'unicode@example.test', role: 'MANAGER', password: '😀'.repeat(20) })).status, 400);
      const before = readdirSync(process.env.UPLOAD_DIR!).sort();
      const big = new FormData(); big.append('files', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/webp' }), 'oversize.webp');
      assert.equal((await fetch(base + '/requests', { method: 'POST', headers: await mutationHeaders(), body: big })).status, 400);
      assert.deepEqual(readdirSync(process.env.UPLOAD_DIR!).sort(), before);
      assert.equal(await db.rateBucket.count({ where: { key: { startsWith: 'upload-reservation:' } } }), 0);
      const fields = new FormData(); for (let i = 0; i < 22; i++) fields.append('field' + i, 'x');
      assert.equal((await fetch(base + '/requests', { method: 'POST', headers: await mutationHeaders(), body: fields })).status, 400);
      for (let i = 0; i < 10; i++) assert.equal((await call('/auth/login', { email: 'absent@example.test', password: 'test-invalid' }, 'POST', '')).status, 401);
      assert.ok(await db.securityAlert.count({ where: { type: 'LOGIN_FAILED' } }));
      assert.equal((await call('/security', undefined, 'GET', managerCookie)).status, 403);
      const security = await call<{ events: { type: string }[]; alerts: unknown[] }>('/security');
      assert.equal(security.status, 200); assert.ok(security.data.events.some((e) => e.type === 'LOGIN_FAILED'));
      assert.equal((await call('/internal/maintenance', undefined, 'GET', '')).status, 401);
    });
    await t.test('Stolen sessions stop working after password reset and logout', async () => {
      const manager = await db.user.findFirstOrThrow({ where: { role: 'MANAGER' } });
      assert.equal((await call(`/users/${manager.id}`, { password: 'Replaced-security-password-2026' }, 'PATCH')).status, 200);
      assert.equal((await call('/auth/me', undefined, 'GET', managerCookie)).status, 401);
      assert.equal((await call('/auth/logout', {}, 'POST')).status, 200);
      assert.equal((await call('/auth/me', undefined, 'GET', adminCookie)).status, 401);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
  }
});
