export type LogisticsType = "drop-off" | "pickup";
export type OrderStatus = "pending" | "confirmed" | "cleaning" | "drying" | "quality-check" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "success" | "failed";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  loyaltyPoints: number;
}

export interface Order {
  id?: string;
  userId: string;
  quantity: number;
  logistics: LogisticsType;
  services: string[];
  customService?: string;
  shoeImages?: string[];
  address?: string;
  location?: {
    lat: number;
    lng: number;
  };
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  tx_ref?: string;
  estimatedCost: number;
  discountApplied?: number;
  pointsEarned?: number;
  rating?: number;
  review?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ServiceType {
  id: string;
  name: string;
  description: string;
  pricePerShoe: number;
  icon: string;
  image: string;
}

export const AVAILABLE_SERVICES: ServiceType[] = [
  {
    id: "deep-cleaning",
    name: "Deep Cleaning",
    description: "Intensive hand-scrubbing using organic material-specific solutions.",
    pricePerShoe: 1500,
    icon: "Sparkles",
    image: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=400&h=300"
  },
  {
    id: "disinfecting",
    name: "Disinfecting",
    description: "UV-C molecular sterilization and hypoallergenic scent infusion.",
    pricePerShoe: 500,
    icon: "ShieldCheck",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400&h=300"
  },
  {
    id: "shining",
    name: "Shining & Polish",
    description: "Exhibition-grade wax buffing and hydrophobic edge protection.",
    pricePerShoe: 1000,
    icon: "Zap",
    image: "https://images.unsplash.com/photo-1621319330942-887413f412fd?auto=format&fit=crop&q=80&w=400&h=300"
  },
];
