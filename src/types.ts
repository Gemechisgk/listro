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
  category: "footwear" | "apparel";
  services: string[];
  customService?: string;
  itemImages?: string[]; // Generic instead of shoeImages
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
  price: number;
  icon: string;
  image: string;
  category: "footwear" | "apparel";
}

export const AVAILABLE_SERVICES: ServiceType[] = [
  // Footwear
  {
    id: "deep-cleaning",
    name: "Deep Cleaning",
    description: "Intensive hand-scrubbing using organic material-specific solutions.",
    price: 200,
    icon: "Sparkles",
    image: "https://www.johnlobb.com/static/uploads/sites/5/2019/10/care-soft-brush.jpg",
    category: "footwear"
  },
  {
    id: "disinfecting",
    name: "Disinfecting",
    description: "UV-C molecular sterilization and hypoallergenic scent infusion.",
    price: 100,
    icon: "ShieldCheck",
    image: "https://bizimages.withfloats.com/actual/68cd253f903986591cb47968.jpg",
    category: "footwear"
  },
  {
    id: "shining",
    name: "Shining & Polish",
    description: "Exhibition-grade wax buffing and hydrophobic edge protection.",
    price: 150,
    icon: "Zap",
    image: "https://www.theshoecareshop.com/cdn/shop/files/Beginners_poetsen_en_herkleuren.jpg?v=1756384092&width=2400",
    category: "footwear"
  },
  // Apparel
  {
    id: "dry-cleaning",
    name: "Dry Cleaning",
    description: "Eco-friendly solvent-based cleaning for delicate garments and suits.",
    price: 300,
    icon: "Shirt",
    image: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&q=80&w=1000",
    category: "apparel"
  },
  {
    id: "wash-fold",
    name: "Wash & Fold",
    description: "Premium laundering, precision folding, and fresh scent infusion.",
    price: 150,
    icon: "Wind",
    image: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&q=80&w=1000",
    category: "apparel"
  },
  {
    id: "express-ironing",
    name: "Express Ironing",
    description: "Steam-powered crease removal for professional-grade crispness.",
    price: 80,
    icon: "Activity",
    image: "https://images.unsplash.com/photo-1489274495757-95c7c837b101?auto=format&fit=crop&q=80&w=1000",
    category: "apparel"
  }
];
