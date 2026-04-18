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
    pricePerShoe: 200,
    icon: "Sparkles",
    image: "https://www.jabchaho.com/public/assets_new/images/services/detail/shoe-cleaning.jpg"
  },
  {
    id: "disinfecting",
    name: "Disinfecting",
    description: "UV-C molecular sterilization and hypoallergenic scent infusion.",
    pricePerShoe: 100,
    icon: "ShieldCheck",
    image: "https://bizimages.withfloats.com/actual/68cd253f903986591cb47968.jpg"
  },
  {
    id: "shining",
    name: "Shining & Polish",
    description: "Exhibition-grade wax buffing and hydrophobic edge protection.",
    pricePerShoe: 150,
    icon: "Zap",
    image: "https://www.theshoecareshop.com/cdn/shop/files/Beginners_poetsen_en_herkleuren.jpg?v=1756384092&width=2400"
  },
];
