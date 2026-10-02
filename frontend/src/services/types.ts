import type { RequestStatus } from '../../../shared/constants';
export type Role = 'ADMIN' | 'MANAGER' | 'MECHANIC';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active?: boolean;
  _count?: { mechanicRequests: number };
}
export interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: number;
  active: boolean;
}
export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
  cars?: Car[];
  requests?: RequestRecord[];
  workOrders?: WorkOrder[];
}
export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  vin: string | null;
  licensePlate: string | null;
  mileage: number | null;
  clientId: string;
  client?: Client;
  requests?: RequestRecord[];
  _count?: { requests: number };
}
export interface Appointment {
  id: string;
  requestId: number;
  mechanicId: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  mechanic: User;
  request: RequestRecord;
}
export interface OrderItem {
  id?: string;
  kind: 'LABOR' | 'PART';
  name: string;
  quantity: string | number;
  price: string | number;
}
export interface Payment {
  id: string;
  workOrderId: number;
  amount: string;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  createdAt: string;
  user?: User;
  workOrder?: WorkOrder;
}
export interface WorkOrder {
  id: number;
  requestId: number;
  client: Client;
  car: Car;
  request: RequestRecord;
  status: RequestStatus;
  total: string;
  subtotal: string;
  items: OrderItem[];
  payments: Payment[];
  createdAt: string;
}
export interface Task {
  id: string;
  title: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE';
  dueAt: string;
  assigneeId: string;
  assignee: User;
  request?: RequestRecord;
}
export interface RequestRecord {
  id: number;
  status: RequestStatus;
  source: string;
  preferredDate: string | null;
  comment: string;
  managerId: string | null;
  mechanicId: string | null;
  createdAt: string;
  client: Client;
  car: Car;
  service: Service;
  manager: User | null;
  mechanic: User | null;
  appointment: Appointment | null;
  workOrder: WorkOrder | null;
  tasks?: Task[];
  comments?: { id: string; text: string; createdAt: string; user: User }[];
  files?: {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
  }[];
  activities?: {
    id: string;
    description: string;
    createdAt: string;
    user: User | null;
  }[];
}
export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Settings {
  name: string;
  phone: string;
  address: string;
  hours: string;
  email: string;
}
export interface Dashboard {
  counts: Partial<Record<RequestStatus, number>>;
  today: number;
  revenue: number;
  weekly: { date: string; label: string; count: number }[];
  appointments: Appointment[];
  recent: RequestRecord[];
  tasks: Task[];
}
export interface Analytics {
  days: number;
  requests: number;
  newClients: number;
  repeatClients: number;
  completedOrders: number;
  averageCheck: number;
  revenue: number;
  conversion: number;
  services: { name: string; count: number }[];
  sources: { name: string; count: number }[];
}
