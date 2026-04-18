/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Minus, MapPin, Truck, Store, 
  Sparkles, ShieldCheck, Zap, ArrowRight, 
  CheckCircle2, Loader2, ChevronLeft, LogOut,
  User as UserIcon, History, Star, Ticket, Gift,
  Camera, Image as ImageIcon, CreditCard, ExternalLink,
  Clock, PackageCheck, Thermometer, Search,
  Sun, Moon, Download, Bell, BellOff, Info,
  Filter, Calendar, X, Locate
} from 'lucide-react';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User 
} from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, getDoc, setDoc, increment, arrayUnion 
} from 'firebase/firestore';
import { auth, db, messaging, getToken, onMessage } from './lib/firebase';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn, formatCurrency } from './lib/utils';
import { AVAILABLE_SERVICES, type LogisticsType, type Order, type UserProfile } from './types';
import { TRANSLATIONS } from './translations';

// Fix Leaflet marker icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Components
const Button = ({ 
  children, className, variant = 'primary', size = 'md', isLoading, disabled, ...props 
}: any) => {
  const variants = {
    primary: 'bg-gold text-luxury-black hover:bg-gold/90 border-transparent font-bold tracking-widest uppercase',
    secondary: 'bg-luxury-gray text-white hover:bg-luxury-gray/80 border-luxury-border',
    outline: 'bg-transparent border-luxury-border text-white hover:bg-white/5',
    ghost: 'bg-transparent text-white/60 hover:text-white',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button 
      className={cn(
        'relative inline-flex items-center justify-center rounded-full transition-all duration-300 border focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant as keyof typeof variants],
        sizes[size as keyof typeof sizes],
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
};

const StarRating = ({ rating, setRating, interactive = false }: { rating: number, setRating?: (n: number) => void, interactive?: boolean }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && setRating?.(star)}
          className={cn(
            "transition-colors",
            star <= rating ? "text-gold" : "text-white/10",
            interactive ? "hover:scale-110 active:scale-95" : "cursor-default"
          )}
        >
          <Star className={cn(interactive ? "w-6 h-6" : "w-4 h-4", star <= rating && "fill-current")} />
        </button>
      ))}
    </div>
  );
};

const AddressAutocomplete = ({ 
  onSelect, 
  defaultValue = "",
  t
}: { 
  onSelect: (address: string, coords?: { lat: number, lng: number }) => void, 
  defaultValue?: string,
  t: (key: any) => string
}) => {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'OK' | 'ZERO_RESULTS'>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setValue(query);
    setError(null);

    if (query.length < 3) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }

    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
      setSuggestions(response.data);
      setStatus(response.data.length > 0 ? 'OK' : 'ZERO_RESULTS');
    } catch (err) {
      console.error("Nominatim search failed", err);
    }
  };

  const handleSelect = (sug: any) => () => {
    const lat = parseFloat(sug.lat);
    const lon = parseFloat(sug.lon);
    setValue(sug.display_name);
    setSuggestions([]);
    setStatus('idle');
    onSelect(sug.display_name, { lat, lng: lon });
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsVerifying(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (response.data) {
            const addr = response.data.display_name;
            setValue(addr);
            onSelect(addr, { lat: latitude, lng: longitude });
          }
        } catch (err) {
          console.error("Reverse geocoding failed", err);
          onSelect(`${latitude}, ${longitude}`, { lat: latitude, lng: longitude });
        } finally {
          setIsVerifying(false);
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        setError("Location access denied or unavailable");
        setIsVerifying(false);
      }
    );
  };

  return (
    <div className="relative w-full">
      <div className={cn(
        "luxury-card flex items-center gap-4 py-4 px-6 border-gold/30 transition-all",
        error && "border-red-500/50 bg-red-500/5"
      )}>
        <MapPin className={cn("text-gold w-5 h-5 flex-shrink-0", isVerifying && "animate-pulse")} />
        <input
          value={value}
          onChange={handleInput}
          disabled={isVerifying}
          placeholder={t('addressPlaceholder')}
          className="bg-transparent border-none flex-1 focus:ring-0 text-white placeholder:text-text-dim py-2 outline-none"
        />
        {isVerifying ? (
          <Loader2 className="w-4 h-4 text-gold animate-spin" />
        ) : (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); captureLocation(); }}
            className="p-1.5 hover:bg-white/5 rounded-full transition-colors group"
            title="Use current location"
          >
            <Locate className="w-4 h-4 text-gold/40 group-hover:text-gold" />
          </button>
        )}
      </div>
      
      {error && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-red-400 uppercase tracking-widest font-bold px-2">
          <Info className="w-3 h-3" />
          {error}
        </div>
      )}

      {status === "OK" && (
        <ul className="absolute z-50 w-full mt-2 luxury-card p-2 border-gold/30 shadow-2xl max-h-60 overflow-y-auto bg-luxury-black/95 backdrop-blur-xl">
          {suggestions.map((sug) => (
            <li 
              key={sug.place_id} 
              onClick={handleSelect(sug)}
              className="p-3 hover:bg-gold/10 cursor-pointer rounded-lg transition-colors border-b border-white/5 last:border-none group"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gold/40 group-hover:text-gold" />
                <span className="text-[11px] text-white/80 group-hover:text-white transition-colors">{sug.display_name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


export default function App() {
  const [lang, setLang] = useState<'en' | 'am'>('en');
  const t = (key: keyof typeof TRANSLATIONS['en']) => TRANSLATIONS[lang][key] || (key as string);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);
  const [step, setStep] = useState(0); 
  const [view, setView] = useState<'home' | 'history'>('home');
  const [orders, setOrders] = useState<Order[]>([]);

  // Booking State
  const [quantity, setQuantity] = useState(1);
  const [logistics, setLogistics] = useState<LogisticsType>('drop-off');
  const [selectedServices, setSelectedServices] = useState<string[]>(['deep-cleaning']);
  const [customService, setCustomService] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shoeImages, setShoeImages] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initializing' | 'waiting' | 'failed'>('idle');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Loyalty & Discounts
  const [couponCode, setCouponCode] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [activeNotification, setActiveNotification] = useState<{title: string, body: string} | null>(null);

  // History Filtering
  const [filterService, setFilterService] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [heroVideoLoaded, setHeroVideoLoaded] = useState(false);
  const [heroVideoError, setHeroVideoError] = useState(false);

  useEffect(() => {
    // Fallback to hide loader if video takes too long
    const timer = setTimeout(() => {
      setHeroVideoLoaded(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchService = filterService === 'all' || order.services.includes(filterService);
      
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      const start = filterStartDate ? new Date(filterStartDate) : null;
      const end = filterEndDate ? new Date(filterEndDate) : null;
      
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      
      const matchDate = (!start || orderDate >= start) && (!end || orderDate <= end);
      
      return matchService && matchDate;
    });
  }, [orders, filterService, filterStartDate, filterEndDate]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!messaging || !user) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'YOUR_PUBLIC_VAPID_KEY_HERE' 
        });
        if (token) {
          setFcmToken(token);
          // Save token to user profile
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token)
          });
        }
      }
    } catch (error) {
      console.error('Notification permission failed:', error);
    }
  };

  useEffect(() => {
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        if (payload.notification) {
          setActiveNotification({
            title: payload.notification.title || 'ሊ-STRO Update',
            body: payload.notification.body || ''
          });
          // Auto-hide after 10 seconds
          setTimeout(() => setActiveNotification(null), 10000);
        }
      });
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
      if (!hasSeenWalkthrough) {
        setWalkthroughStep(1);
      }
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        const d = await getDoc(userRef);
        if (d.exists()) {
          setProfile(d.data() as UserProfile);
        } else {
          const newProfile = {
            uid: u.uid,
            email: u.email!,
            displayName: u.displayName || 'Atelier Enthusiast',
            photoURL: u.photoURL || '',
            loyaltyPoints: 0
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile as UserProfile);
        }
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(splashTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      
      // Update local profile points if needed (simple sync)
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(d => d.exists() && setProfile(d.data() as UserProfile));
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
  }, [theme]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const subtotal = useMemo(() => {
    const servicesTotal = selectedServices.reduce((acc, serviceId) => {
      const service = AVAILABLE_SERVICES.find(s => s.id === serviceId);
      return acc + (service?.pricePerShoe || 0);
    }, 0);
    return quantity * servicesTotal;
  }, [quantity, selectedServices]);

  const logisticsFee = logistics === 'pickup' ? 100 : 0;
  const referralDiscount = couponCode.toUpperCase() === 'LISTRO20' && discountValue > 0 ? (subtotal * 0.2) : 0;
  const loyaltySavings = redeemPoints ? Math.min(subtotal - referralDiscount, (profile?.loyaltyPoints || 0) / 10) : 0;
  const total = Math.max(0, subtotal - referralDiscount - loyaltySavings) + logisticsFee;

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === 'LISTRO20') {
      setDiscountValue(20); // Using 20 as a flag for 20%
      alert(t('couponApplied'));
    } else {
      alert(t('invalidCoupon'));
      setDiscountValue(0);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // For the demo, we use local object URLs. 
      // In production, these should be uploaded to Firebase Storage.
      const newImages = Array.from(files).map(file => URL.createObjectURL(file as Blob));
      setShoeImages(prev => [...prev, ...newImages]);
    }
  };

  const initPayment = async () => {
    if (!user) return null;
    setPaymentStatus('initializing');
    try {
      const tx_ref = `listro-${nanoid(8)}`;
      const response = await axios.post('/api/payments/initialize', {
        amount: total,
        email: user.email,
        firstName: user.displayName?.split(' ')[0] || 'Atelier',
        lastName: user.displayName?.split(' ')[1] || 'Guest',
        tx_ref,
        return_url: window.location.origin + '?payment=success&ref=' + tx_ref
      });

      if (response.data.status === 'success') {
        const checkout_url = response.data.data.checkout_url;
        setPaymentStatus('waiting');
        return { tx_ref, checkout_url };
      }
      throw new Error('Payment initialization failed');
    } catch (error) {
      console.error('Payment Error:', error);
      setPaymentStatus('failed');
      return null;
    }
  };

  const placeOrder = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const paymentInfo = await initPayment();
      if (!paymentInfo) {
        setIsSubmitting(false);
        return;
      }

      const { tx_ref, checkout_url } = paymentInfo;
      const pointsToEarn = Math.floor(total);
      const pointsToSpend = redeemPoints ? loyaltySavings * 10 : 0;

      const orderData: any = {
        userId: user.uid,
        quantity,
        logistics,
        services: selectedServices,
        address: logistics === 'pickup' ? address : 'Shop Drop-off',
        addressCoords: logistics === 'pickup' ? addressCoords : null,
        status: 'pending',
        paymentStatus: 'pending',
        tx_ref,
        estimatedCost: total,
        discountApplied: referralDiscount + loyaltySavings,
        pointsEarned: pointsToEarn,
        shoeImages, 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      if (customService) {
        orderData.customService = customService;
      }
      
      await addDoc(collection(db, 'orders'), orderData);
      
      // Update loyalty points
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        loyaltyPoints: increment(pointsToEarn - pointsToSpend)
      });

      // Redirect immediately using the URL from paymentInfo
      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        setStep(3); // Completion screen
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Order failed. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReview = async (orderId: string, rating: number, reviewText: string) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      rating,
      review: reviewText,
      updatedAt: serverTimestamp()
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-gold animate-spin" />
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-luxury-black flex items-center justify-center z-[100]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 md:w-32 md:h-32 p-4 bg-gold/5 rounded-full border border-gold/20 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gold/10 animate-pulse" />
            <img src="/asset/shiner-logo.svg" alt="Listro" className="w-16 h-16 md:w-20 md:h-20 object-contain relative z-10" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-serif text-white tracking-[0.2em] uppercase mb-2">ሊ-stro</h1>
            <div className="h-0.5 w-12 bg-gold mx-auto rounded-full" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (walkthroughStep !== null) {
    const steps = [
      { title: 'walkthroughTitle1', desc: 'walkthroughDesc1', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000' },
      { title: 'walkthroughTitle2', desc: 'walkthroughDesc2', img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=1000' },
      { title: 'walkthroughTitle3', desc: 'walkthroughDesc3', img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000' }
    ];

    const finishWalkthrough = () => {
      localStorage.setItem('hasSeenWalkthrough', 'true');
      setWalkthroughStep(null);
    };

    return (
      <div className="fixed inset-0 bg-luxury-black z-50 flex flex-col">
        <div className="relative flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={walkthroughStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-black via-luxury-black/40 to-transparent z-10" />
              <img 
                src={steps[walkthroughStep - 1].img} 
                className="w-full h-full object-cover grayscale opacity-60" 
                alt="Walkthrough"
              />
              <div className="absolute bottom-32 left-8 right-8 z-20">
                <p className="text-gold text-[10px] uppercase tracking-[0.4em] font-bold mb-4">Step 0{walkthroughStep}</p>
                <h2 className="text-4xl md:text-5xl font-serif text-white mb-4 leading-tight">{t(steps[walkthroughStep - 1].title as any)}</h2>
                <p className="text-text-dim text-sm md:text-base max-w-md leading-relaxed">{t(steps[walkthroughStep - 1].desc as any)}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-8 pb-12 bg-luxury-black/90 backdrop-blur-xl border-t border-luxury-border flex items-center justify-between">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1 rounded-full transition-all duration-500", s === walkthroughStep ? "w-8 bg-gold" : "w-2 bg-luxury-border")} />
            ))}
          </div>
          <div className="flex gap-4">
            {walkthroughStep < 3 ? (
              <>
                <button onClick={finishWalkthrough} className="text-[10px] text-text-dim uppercase tracking-widest font-bold hover:text-white transition-colors">{t('skip')}</button>
                <Button onClick={() => setWalkthroughStep(walkthroughStep + 1)} className="px-8 rounded-full">{t('next')} <ArrowRight className="w-4 h-4" /></Button>
              </>
            ) : (
              <Button onClick={finishWalkthrough} className="px-12 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">{t('getStarted')}</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden px-6 text-center">
        <div className="absolute inset-0 grayscale opacity-10">
          <img src="https://images.unsplash.com/photo-1623945417032-47864f199320?auto=format&fit=crop&q=80&w=1920&h=1080" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className="relative z-10 max-w-sm">
          <h1 className="font-serif text-6xl mb-4 text-gold tracking-[0.2em]">{t('brand')}</h1>
          <p className="text-text-dim mb-12 tracking-widest font-light text-xs uppercase italic">{t('tagline')}</p>
          <Button onClick={handleLogin} size="lg" className="w-full">
            {t('authenticate')}
          </Button>
        </div>

        {/* Image Zoom Overlay */}
        <AnimatePresence>
          {zoomedImage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(null)}
              className="fixed inset-0 z-[110] bg-luxury-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            >
              <div className="absolute top-0 right-0 p-6">
                <button className="text-text-dim hover:text-white transition-colors">
                  <X className="w-8 h-8" />
                </button>
              </div>
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl max-h-full aspect-square md:aspect-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={zoomedImage} 
                  className="w-full h-full object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)]" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-luxury-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-gold/20">
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">{t('inspectDetail')}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracking Placeholder Overlay */}
        <AnimatePresence>
          {trackingOrder && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-luxury-black/90 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <div className="luxury-card max-w-lg w-full p-8 border-gold/30 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setTrackingOrder(null)} className="text-text-dim hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Truck className="w-8 h-8 text-gold animate-bounce" />
                  </div>
                  <h3 className="text-2xl font-serif">Global Logistics Tracking</h3>
                  <p className="text-text-dim text-xs uppercase tracking-widest">Order Reference: {trackingOrder.tx_ref || trackingOrder.id?.slice(0, 8)}</p>
                </div>

                <div className="space-y-6 pt-6">
                  {[
                    { title: 'Courier Assigned', desc: 'Elite Mobility Partner confirmed', date: 'In Transit' },
                    { title: 'Final Inspection', desc: 'Atelier Quality Assurance Passed', date: 'Completed' },
                    { title: 'Restoration Cycle', desc: 'Precision cleaning and hydration complete', date: 'Completed' }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex flex-col items-center">
                        <div className={cn("w-3 h-3 rounded-full", i === 0 ? "bg-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]" : "bg-gold/20")} />
                        {i < 2 && <div className="w-[1px] h-12 bg-luxury-border" />}
                      </div>
                      <div>
                        <p className={cn("text-sm font-bold", i === 0 ? "text-gold" : "text-white")}>{step.title}</p>
                        <p className="text-[10px] text-text-dim mt-1">{step.desc}</p>
                        <p className="text-[8px] uppercase tracking-tighter text-gold/50 mt-1">{step.date}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gold/5 border border-gold/10 p-4 rounded-lg text-center">
                  <p className="text-[10px] text-text-dim italic">Estimated delivery to Atelier collection point within 48 hours.</p>
                </div>

                <Button size="md" className="w-full" onClick={() => setTrackingOrder(null)}>Close Tracker</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="h-20 px-4 md:px-10 flex justify-between items-center border-b border-luxury-border sticky top-0 z-50 backdrop-blur-md bg-opacity-80" style={{ backgroundColor: 'var(--bg-main)' }}>
        <div className="flex items-center gap-4">
          <div className="text-xl md:text-2xl font-bold tracking-[0.2em] text-gold font-serif cursor-pointer" onClick={() => { setStep(0); setView('home'); }}>ሊ STRO</div>
          {deferredPrompt && (
            <button onClick={installPWA} className="p-2 text-gold animate-bounce" title="Install App">
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-8">
           <button 
            onClick={() => setLang(lang === 'en' ? 'am' : 'en')} 
            className="p-1.5 md:p-2 rounded-full text-gold/80 hover:text-gold transition-all border border-gold/20 hover:border-gold/50 flex items-center gap-2 bg-gold/5"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest">{lang === 'en' ? 'AM' : 'EN'}</span>
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full text-gold/60 hover:text-gold transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-luxury-border uppercase tracking-widest font-bold">{t('loyaltyPoints')}</span>
            <span className="text-gold font-medium flex items-center gap-1.5 text-xs md:text-sm">
              <Gift className="w-3 h-3" />
              {profile?.loyaltyPoints || 0}
            </span>
          </div>
          <div className="hidden sm:block h-8 w-[1px] bg-luxury-border" />
          <div className="flex items-center gap-2 md:gap-3">
             {notificationPermission !== 'granted' && (
               <button 
                 onClick={requestNotificationPermission}
                 className="p-2 text-gold/60 hover:text-gold transition-colors relative"
                 title="Enable Notifications"
               >
                 <BellOff className="w-5 h-5" />
                 <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
               </button>
             )}
             <div className="hidden sm:block text-right">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-tighter opacity-80 max-w-[80px] md:max-w-none truncate">{user.displayName}</p>
                <button onClick={() => setView(view === 'history' ? 'home' : 'history')} className="text-[9px] md:text-[10px] text-gold uppercase tracking-widest hover:underline">
                   {view === 'history' ? t('dashboard') : t('history')}
                </button>
             </div>
             <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-luxury-border overflow-hidden flex-shrink-0">
                <img src={user.photoURL || ''} className="w-full h-full object-cover" />
             </div>
             <button onClick={() => signOut(auth)} className="p-1 md:p-2 rounded-full text-white/20 hover:text-white transition-colors">
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* In-App Notification Alert */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
          >
            <div className="luxury-card border-gold bg-gold/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                <Bell className="text-gold w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gold mb-1">{activeNotification.title}</h4>
                <p className="text-[11px] text-white/80 italic">{activeNotification.body}</p>
              </div>
              <button onClick={() => setActiveNotification(null)} className="text-white/20 hover:text-white">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn("flex-1 p-4 md:p-10 gap-6 md:gap-10", view === 'home' && step < 3 ? "flex flex-col lg:grid lg:grid-cols-[350px_1fr]" : "flex flex-col max-w-4xl mx-auto w-full")}>
        {view === 'home' && step < 3 && (
          <aside className="flex flex-col gap-6 lg:h-[calc(100vh-140px)] lg:sticky lg:top-28">
            <div className="luxury-card border-none bg-transparent lg:bg-luxury-gray/80 lg:border lg:border-luxury-border p-2 lg:p-6 rounded-xl">
               <div className="flex flex-row lg:flex-col gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
                  {[
                    { n: '01', l: t('atelier'), s: 0 },
                    { n: '02', l: t('logistics'), s: 1 },
                    { n: '03', l: t('review'), s: 2 }
                  ].map(st => (
                    <div key={st.n} className={cn("flex items-center gap-4 transition-opacity flex-shrink-0", step === st.s ? "opacity-100" : "opacity-30")}>
                      <div className={cn("step-num", step === st.s && "bg-gold border-gold text-white font-bold text-xs")}>{st.n}</div>
                      <span className="text-xs lg:text-sm font-medium tracking-wide">{st.l}</span>
                    </div>
                  ))}
               </div>
            </div>

             <div className="luxury-card flex flex-col gap-6">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-bold">{t('orderSelection')}</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-text-dim">{t('items')}</span>
                     <span>{quantity} {quantity === 1 ? t('pair') : t('pairs')}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-text-dim">{t('baseCare')}</span>
                     <span className="text-right max-w-[150px] truncate">
                       {selectedServices.map(sid => {
                         const s = AVAILABLE_SERVICES.find(as => as.id === sid);
                         if (!s) return '';
                         if (sid === 'deep-cleaning') return t('deepCleaningName');
                         if (sid === 'disinfecting') return t('disinfectingName');
                         if (sid === 'shining') return t('shiningName');
                         return s.name;
                       }).join(', ')}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-text-dim">{t('logistics')}</span>
                     <span className="capitalize">{logistics === 'drop-off' ? t('dropOff') : t('pickup')}</span>
                   </div>

                   {logistics === 'pickup' && (
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-text-dim">{t('pickupFee')}</span>
                       <span>{formatCurrency(1000)}</span>
                     </div>
                   )}

                  {discountValue > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-500">
                      <span className="flex items-center gap-1 font-bold tracking-tighter">DISCOUNT</span>
                      <span>-{formatCurrency(discountValue)}</span>
                    </div>
                  )}

                  {redeemPoints && loyaltySavings > 0 && (
                    <div className="flex justify-between items-center text-sm text-gold">
                      <span className="flex items-center gap-1 font-bold tracking-tighter uppercase">POINTS</span>
                      <span>-{formatCurrency(loyaltySavings)}</span>
                    </div>
                  )}

                  <div className="pt-6 border-t border-luxury-border flex justify-between items-center">
                    <span className="text-lg font-bold">{t('total')}</span>
                    <span className="text-2xl font-bold text-gold">{formatCurrency(total, lang)}</span>
                  </div>
               </div>
            </div>
          </aside>
        )}

        <div className="flex flex-col gap-10">
          <AnimatePresence mode="wait">
            {view === 'history' ? (
              <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-serif">{t('missionArchive')}</h2>
                  <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[10px] uppercase tracking-widest font-bold",
                      isFilterOpen || filterService !== 'all' || filterStartDate || filterEndDate 
                        ? "border-gold text-gold bg-gold/10" 
                        : "border-luxury-border text-text-dim hover:text-white"
                    )}
                  >
                    <Filter className="w-3 h-3" />
                    {isFilterOpen ? t('resetParameters') : t('filterArchive')}
                  </button>
                </div>

                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="luxury-card grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('serviceType')}</label>
                          <select 
                            value={filterService}
                            onChange={(e) => setFilterService(e.target.value)}
                            className="w-full bg-luxury-black border border-luxury-border rounded p-3 text-xs text-white focus:border-gold outline-none"
                          >
                            <option value="all">{t('allSpecialties')}</option>
                            {AVAILABLE_SERVICES.map(s => (
                              <option key={s.id} value={s.id}>{s.id === 'deep-cleaning' ? t('deepCleaningName') : s.id === 'disinfecting' ? t('disinfectingName') : t('shiningName')}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('fromDate')}</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gold opacity-50" />
                            <input 
                              type="date"
                              value={filterStartDate}
                              onChange={(e) => setFilterStartDate(e.target.value)}
                              className="w-full bg-luxury-black border border-luxury-border rounded p-3 pl-10 text-xs text-white focus:border-gold outline-none [color-scheme:dark]"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('toDate')}</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gold opacity-50" />
                            <input 
                              type="date"
                              value={filterEndDate}
                              onChange={(e) => setFilterEndDate(e.target.value)}
                              className="w-full bg-luxury-black border border-luxury-border rounded p-3 pl-10 text-xs text-white focus:border-gold outline-none [color-scheme:dark]"
                            />
                          </div>
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                           <button 
                            onClick={() => {
                              setFilterService('all');
                              setFilterStartDate('');
                              setFilterEndDate('');
                            }}
                            className="text-[10px] uppercase tracking-widest text-gold hover:underline font-bold flex items-center gap-2"
                           >
                              <X className="w-3 h-3" /> {t('resetParameters')}
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {filteredOrders.length === 0 ? (
                   <div className="luxury-card text-center py-20 space-y-4">
                      <History className="w-12 h-12 text-white/5 mx-auto" />
                      <p className="text-text-dim italic">{t('missionArchiveEmpty')}</p>
                   </div>
                ) : (
                  <div className="grid gap-6">
                    {filteredOrders.map(o => (
                      <div key={o.id} className="luxury-card flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] uppercase text-text-dim mb-1 font-bold">{o.createdAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) || t('recentEngagement')}</p>
                            <h4 className="font-serif text-lg">{o.quantity} {o.quantity === 1 ? t('pair') : t('pairs')} {t('restoration')}</h4>
                            <div className="flex flex-wrap gap-2 mt-3">
                               {o.services.map(sid => {
                                  const service = AVAILABLE_SERVICES.find(s => s.id === sid);
                                  if (!service) return null;
                                  const Icon = sid === 'deep-cleaning' ? Sparkles : 
                                              sid === 'disinfecting' ? ShieldCheck : 
                                              sid === 'shining' ? Zap : Info;
                                  return (
                                     <div key={sid} className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.15em] text-white/50 font-bold bg-white/5 px-2 py-1 rounded border border-white/5">
                                        <Icon className="w-2.5 h-2.5 text-gold/70" />
                                        {sid === 'deep-cleaning' ? t('deepCleaningName') : sid === 'disinfecting' ? t('disinfectingName') : t('shiningName')}
                                     </div>
                                  );
                               })}
                            </div>
                          </div>
                          <div className="text-right">
                             <span className={cn(
                               "px-2 py-1 border text-[8px] uppercase tracking-widest rounded font-bold",
                               o.status === 'completed' ? "border-green-500/30 text-green-500" : 
                               o.status === 'cancelled' ? "border-red-500/30 text-red-500" :
                               "border-gold/30 text-gold"
                             )}>{t(o.status.replace('-', ''))}</span>
                              <p className="text-gold font-bold mt-2">{formatCurrency(o.estimatedCost, lang)}</p>
                              {o.status === 'completed' && (
                                <button 
                                  onClick={() => setTrackingOrder(o)}
                                  className="mt-2 flex items-center gap-1 text-[9px] text-gold uppercase tracking-widest hover:underline font-bold"
                                >
                                  <Truck className="w-3 h-3" /> {t('trackOrder')}
                                </button>
                              )}
                           </div>
                        </div>

                        {/* Payment Status Indicator */}
                        <div className="flex flex-wrap gap-4 items-center">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] uppercase tracking-widest font-bold border",
                            o.paymentStatus === 'success' ? "bg-green-500/10 border-green-500/30 text-green-500" :
                            o.paymentStatus === 'failed' ? "bg-red-500/10 border-red-500/30 text-red-500" :
                            "bg-orange-500/10 border-orange-500/30 text-orange-500"
                          )}>
                            {o.paymentStatus === 'success' ? <CheckCircle2 className="w-3 h-3" /> :
                             o.paymentStatus === 'failed' ? <BellOff className="w-3 h-3" /> :
                             <CreditCard className="w-3 h-3" />}
                            {t('payment')}: {t(o.paymentStatus || 'pending')}
                          </div>
                          
                          {o.paymentStatus === 'success' && o.tx_ref && (
                            <div className="flex items-center gap-2 text-[10px] text-text-dim italic">
                              <span className="font-bold uppercase tracking-tighter not-italic text-[8px] opacity-50">{t('ref')}:</span>
                              {o.tx_ref}
                            </div>
                          )}
                        </div>

                        {/* Order Photos */}
                        {o.shoeImages && o.shoeImages.length > 0 && (
                          <div className="pt-2">
                             <p className="text-[9px] uppercase tracking-widest text-text-dim mb-3 font-bold opacity-50">{t('archivedPhotography')}</p>
                             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {o.shoeImages.map((img, i) => (
                                   <div 
                                      key={i} 
                                      onClick={() => setZoomedImage(img)}
                                      className="w-20 h-20 flex-shrink-0 rounded-lg border border-luxury-border overflow-hidden cursor-zoom-in hover:border-gold/50 transition-all hover:scale-105 active:scale-95 group relative"
                                   >
                                      <img src={img} className="w-full h-full object-cover transition-all" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/5 transition-colors" />
                                   </div>
                                ))}
                             </div>
                          </div>
                        )}

                        {/* Order Timeline */}
                        <div className="py-10 overflow-x-auto scrollbar-hide -mx-6 px-6">
                          <div className="flex items-center justify-between min-w-[650px] mb-12 relative px-2">
                             {[
                               { id: 'pending', label: t('received'), icon: Clock },
                               { id: 'confirmed', label: t('accepted'), icon: ShieldCheck },
                               { id: 'cleaning', label: t('cleaning'), icon: Sparkles },
                               { id: 'drying', label: t('drying'), icon: Thermometer },
                               { id: 'quality-check', label: t('polish'), icon: Search },
                               { id: 'ready', label: t('ready'), icon: PackageCheck }
                             ].map((st, idx, arr) => {
                               const statuses = arr.map(a => a.id);
                               const currentIndex = statuses.indexOf(o.status === 'completed' ? 'ready' : o.status);
                               const isActive = idx <= currentIndex && o.status !== 'cancelled';
                               const isCurrent = st.id === o.status;
                               
                               return (
                                 <div key={st.id} className="flex items-center flex-1 last:flex-none">
                                   <div className="flex flex-col items-center gap-2 relative">
                                      <div className={cn(
                                        "w-9 h-9 md:w-11 md:h-11 rounded-full border flex items-center justify-center transition-all duration-700 z-10",
                                        isActive ? "bg-gold border-gold text-[#0F0F0F] shadow-[0_0_20px_rgba(212,175,55,0.4)]" : "bg-luxury-gray/30 border-luxury-border text-text-dim",
                                        isCurrent && "ring-4 ring-gold/30 scale-110"
                                      )}>
                                         <st.icon className="w-4 h-4 md:w-5 md:h-5" />
                                      </div>
                                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 text-center">
                                        <span className={cn(
                                          "text-[8px] md:text-[9px] uppercase tracking-[0.15em] font-bold block transition-colors duration-500", 
                                          isActive ? "text-gold" : "text-text-dim"
                                        )}>
                                          {st.label}
                                        </span>
                                      </div>
                                   </div>
                                   {idx < arr.length - 1 && (
                                     <div className="flex-1 h-[2px] mx-1 relative overflow-hidden bg-luxury-border/30 rounded-full">
                                        <motion.div 
                                          initial={{ scaleX: 0 }}
                                          animate={{ scaleX: isActive ? 1 : 0 }}
                                          className="absolute inset-0 bg-gold origin-left transition-transform duration-1000 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                                        />
                                     </div>
                                   )}
                                 </div>
                               );
                             })}
                          </div>
                        </div>
                        
                        {o.status === 'completed' && !o.rating && (
                          <div className="pt-4 border-t border-luxury-border">
                             <p className="text-[10px] uppercase tracking-widest text-text-dim mb-4 font-bold">Feedback Required</p>
                             <ReviewForm orderId={o.id!} onSubmit={submitReview} t={t} />
                          </div>
                        )}

                        {(o.rating || o.review) && (
                           <div className="pt-4 border-t border-luxury-border flex items-start gap-4">
                              <StarRating rating={o.rating || 0} />
                              <div className="flex-1">
                                 {o.review && <p className="text-xs text-text-dim italic leading-relaxed">"{o.review}"</p>}
                              </div>
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : step === 0 ? (
              <motion.div key="conf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                <div className="relative h-48 md:h-64 rounded-xl overflow-hidden group bg-luxury-gray/10">
                  {!heroVideoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-luxury-black/80 z-30">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-gold animate-spin" />
                        <span className="text-[10px] uppercase tracking-widest text-gold font-bold">{t('awaitingMasterpiece')}</span>
                      </div>
                    </div>
                  )}
                  {heroVideoError ? (
                    <div className="w-full h-full relative">
                      <img 
                        src="https://www.jabchaho.com/public/assets_new/images/services/detail/shoe-cleaning.jpg" 
                        className={cn(
                          "w-full h-full object-cover transition-all duration-1000",
                          heroImageLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onLoad={() => {
                          setHeroImageLoaded(true);
                          setHeroVideoLoaded(true);
                        }}
                        onError={() => setHeroVideoLoaded(true)}
                        referrerPolicy="no-referrer"
                      />
                      {!heroImageLoaded && (
                        <div className="absolute inset-0 bg-luxury-black flex items-center justify-center">
                           <Sparkles className="w-12 h-12 text-gold/20 animate-pulse" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <video 
                      src="/asset/video_2026-04-18_10-06-50.mp4"
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      onLoadedData={() => setHeroVideoLoaded(true)}
                      onError={() => {
                        console.error("Video load failed, switching to image");
                        setHeroVideoError(true);
                      }}
                      className={cn(
                        "w-full h-full object-cover transition-all duration-1000 group-hover:scale-105",
                        heroVideoLoaded ? "opacity-100 scale-100" : "opacity-0 scale-110"
                      )}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-luxury-black via-transparent/20 to-transparent z-10" />
                  <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 z-20">
                    <p className="text-gold text-[8px] md:text-[10px] uppercase tracking-[0.4em] font-bold mb-1 shadow-black/50 text-shadow-sm">{t('eliteWorkshop')}</p>
                    <h3 className="text-xl md:text-2xl font-serif text-shadow-lg">{t('exhibitionGradeCare')}</h3>
                  </div>
                </div>
                
                <section>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl font-light mb-1">{t('quantityLogistics')}</h2>
                    <p className="text-text-dim text-xs md:text-sm">{t('defineScope')}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-8 sm:gap-16 sm:items-end">
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('pairsToRestore')}</p>
                      <div className="flex items-center gap-6">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-full border border-luxury-border bg-luxury-black hover:bg-gold hover:text-luxury-black transition-all">-</button>
                        <span className="text-2xl md:text-3xl font-serif w-8 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-full border border-luxury-border bg-luxury-black hover:bg-gold hover:text-luxury-black transition-all">+</button>
                      </div>
                    </div>
                    <div className="space-y-3 flex-1 max-w-sm">
                      <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('movementMethodTitle')}</p>
                      <div className="bg-luxury-black p-1.5 rounded-lg border border-luxury-border flex">
                        <button onClick={() => setLogistics('drop-off')} className={cn("flex-1 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all", logistics === 'drop-off' ? "bg-gold text-luxury-black shadow-lg" : "text-text-dim")}>{t('dropOff')}</button>
                        <button onClick={() => setLogistics('pickup')} className={cn("flex-1 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all", logistics === 'pickup' ? "bg-gold text-luxury-black shadow-lg" : "text-text-dim")}>{t('pickup')}</button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {logistics === 'pickup' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4 pt-4"
                      >
                         <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('pickupInformation')}</p>
                         <AddressAutocomplete 
                          onSelect={(addr, coords) => {
                            setAddress(addr);
                            if (coords) setAddressCoords(coords);
                            else setAddressCoords(null);
                          }} 
                          defaultValue={address} 
                          t={t}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                <section>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl font-light mb-1">{t('footwearPhotography')}</h2>
                    <p className="text-text-dim text-xs md:text-sm">{t('documentItems')}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {shoeImages.map((src, idx) => (
                      <div key={idx} className="aspect-square rounded-lg border border-luxury-border overflow-hidden relative group cursor-zoom-in">
                        <img 
                          src={src} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                          onClick={() => setZoomedImage(src)}
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShoeImages(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-lg border border-dashed border-luxury-border flex flex-col items-center justify-center cursor-pointer hover:border-gold hover:bg-gold/5 transition-all group">
                      <Camera className="w-6 h-6 text-text-dim group-hover:text-gold mb-2" />
                      <span className="text-[10px] uppercase font-bold text-text-dim group-hover:text-gold">{t('addPhoto')}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </section>

                <section>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl font-light mb-1">{t('customization')}</h2>
                    <p className="text-text-dim text-xs md:text-sm">{t('expertTreatments')}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {AVAILABLE_SERVICES.map(service => {
                      const selected = selectedServices.includes(service.id);
                      return (
                        <div 
                          key={service.id} 
                          onClick={() => setSelectedServices(prev => selected ? prev.filter(x => x !== service.id) : [...prev, service.id])} 
                          className={cn(
                            "luxury-card cursor-pointer transition-all hover:border-gold/50 flex flex-col h-full overflow-hidden group", 
                            selected && "border-gold ring-1 ring-gold shadow-[0_0_20px_rgba(212,175,55,0.15)] bg-gold/5"
                          )}
                        >
                          <div className="h-32 mb-4 overflow-hidden -mx-6 -mt-6">
                             <img 
                              src={service.image} 
                              className={cn("w-full h-full object-cover transition-all duration-700 group-hover:scale-110", selected && "scale-105")}
                              referrerPolicy="no-referrer"
                             />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold tracking-tight mb-2 uppercase">{service.id === 'deep-cleaning' ? t('deepCleaningName') : service.id === 'disinfecting' ? t('disinfectingName') : t('shiningName')}</h4>
                            <p className="text-[10px] text-text-dim leading-relaxed mb-6 font-medium italic">{service.id === 'deep-cleaning' ? t('deepCleaningDesc') : service.id === 'disinfecting' ? t('disinfectingDesc') : t('shiningDesc')}</p>
                          </div>
                          <div className="mt-auto pt-4 border-t border-luxury-border flex justify-between items-center">
                             <span className="text-gold text-xs font-bold tracking-tighter">{formatCurrency(service.pricePerShoe, lang)} / pair</span>
                             {selected && <CheckCircle2 className="w-4 h-4 text-gold" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6">
                    <input 
                      type="text" 
                      placeholder={t('addCustomService')} 
                      className="w-full bg-transparent border border-dashed border-luxury-border p-4 rounded-lg text-xs italic focus:border-gold focus:outline-none placeholder:text-text-dim"
                      value={customService}
                      onChange={(e) => setCustomService(e.target.value)}
                    />
                  </div>
                </section>

                <div className="flex justify-center sm:justify-end pt-6">
                  <Button size="lg" onClick={() => setStep(1)} disabled={selectedServices.length === 0 || (logistics === 'pickup' && !address)} className="px-12">
                    {t('proceedToLogistics')}
                  </Button>
                </div>
              </motion.div>
            ) : step === 1 ? (
              <motion.div key="logistics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                 <button onClick={() => setStep(0)} className="text-[10px] text-text-dim uppercase tracking-widest hover:text-white flex items-center gap-1 font-bold">
                    <ChevronLeft className="w-3 h-3" /> {t('back')}
                 </button>
                 
                 {logistics === 'pickup' && (
                    <section>
                       <div className="mb-8">
                        <h2 className="text-3xl font-light mb-1">{t('pickupInformation')}</h2>
                        <p className="text-text-dim text-sm">{t('whereShouldCourier')}</p>
                      </div>

                      {addressCoords && (
                        <div className="h-64 rounded-xl overflow-hidden border border-gold/20 shadow-xl relative group mt-6 leaflet-dark">
                          <MapContainer 
                            center={[addressCoords.lat, addressCoords.lng]} 
                            zoom={15} 
                            style={{ width: '100%', height: '100%' }}
                            zoomControl={false}
                          >
                            <TileLayer
                              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                            <Marker position={[addressCoords.lat, addressCoords.lng]} />
                            <MapRecenter center={[addressCoords.lat, addressCoords.lng]} />
                          </MapContainer>
                        </div>
                      )}
                    </section>
                 )}

                 <section>
                    <div className="mb-6 md:mb-8">
                      <h2 className="text-2xl md:text-3xl font-light mb-1">{t('loyaltyPrivileges')}</h2>
                      <p className="text-text-dim text-xs md:text-sm">{t('applyVouchers')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                       <div className="luxury-card space-y-4 flex flex-col justify-between">
                          <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('discountPrivilege')}</p>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                placeholder="PROMO CODE" 
                                className="bg-luxury-black border border-luxury-border flex-1 rounded p-3 text-[11px] uppercase tracking-widest focus:border-gold focus:outline-none placeholder:text-white/10"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                             />
                             <Button size="md" onClick={applyCoupon} variant="outline" className="px-4">{t('apply')}</Button>
                          </div>
                       </div>
                       <div className="luxury-card space-y-4 flex flex-col justify-between">
                          <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">{t('pointRedemption')}</p>
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-xs">{t('balance')}: <span className="text-gold font-bold">{profile?.loyaltyPoints || 0}</span></p>
                                <p className="text-[10px] text-text-dim">{t('availableSavings')}: {formatCurrency(Math.floor((profile?.loyaltyPoints || 0) / 100) * 10, lang)}</p>
                             </div>
                             <button 
                                onClick={() => setRedeemPoints(!redeemPoints)} 
                                className={cn("w-10 h-5 md:w-12 md:h-6 rounded-full relative transition-all duration-300 border", redeemPoints ? "bg-gold border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "bg-luxury-black border-luxury-border")}
                             >
                                <div className={cn("w-3 h-3 md:w-4 md:h-4 rounded-full absolute top-[3.5px] md:top-[3px] transition-all duration-300", redeemPoints ? "left-6 md:left-7 bg-luxury-black" : "left-1 bg-white/20")} />
                             </button>
                          </div>
                       </div>
                    </div>
                 </section>

                 <div className="flex justify-center sm:justify-end pt-6">
                   <Button size="lg" onClick={() => setStep(2)} disabled={logistics === 'pickup' && !address.trim()} className="px-12">
                     {t('reviewManifest')}
                   </Button>
                 </div>
              </motion.div>
            ) : step === 2 ? (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                 <button onClick={() => setStep(1)} className="text-[10px] text-text-dim uppercase tracking-widest hover:text-white flex items-center gap-1 font-bold">
                    <ChevronLeft className="w-3 h-3" /> {t('logistics')}
                 </button>
                                <div className="text-center space-y-4 mb-10">
                    <h2 className="text-3xl md:text-5xl font-serif">{t('finalReview')}</h2>
                    <p className="text-text-dim uppercase tracking-[0.3em] text-[8px] md:text-[10px] font-bold">{t('confirmParameters')}</p>
                 </div>

                 <div className="flex flex-col lg:grid lg:grid-cols-[1fr_350px] gap-8 md:gap-10">
                    <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
                       <div className="luxury-card">
                          <h4 className="text-[10px] uppercase tracking-widest text-text-dim mb-6 font-bold">{t('servicesSelection')}</h4>
                          <div className="space-y-4">
                             {selectedServices.map(s => (
                               <div key={s} className="flex justify-between items-center px-1">
                                  <span className="text-sm font-medium">{AVAILABLE_SERVICES.find(as => as.id === s)?.name}</span>
                                  <span className="text-gold text-xs font-bold">{formatCurrency(AVAILABLE_SERVICES.find(as => as.id === s)?.pricePerShoe || 0, lang)} / pair</span>
                               </div>
                             ))}
                             {customService && (
                               <div className="pt-4 border-t border-luxury-border">
                                  <p className="text-[10px] text-text-dim uppercase mb-1 font-bold">{t('specialRequirement')}</p>
                                  <p className="text-xs italic opacity-80">{customService}</p>
                               </div>
                             )}
                          </div>
                       </div>
                       <div className="luxury-card">
                          <h4 className="text-[10px] uppercase tracking-widest text-text-dim mb-6 font-bold">{t('logisticsInterface')}</h4>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded bg-gold/5 flex items-center justify-center border border-gold/20 flex-shrink-0">
                               {logistics === 'pickup' ? <Truck className="text-gold w-5 h-5 md:w-6 md:h-6" /> : <Store className="text-gold w-5 h-5 md:w-6 md:h-6" />}
                             </div>
                             <div className="flex-1 overflow-hidden">
                                <p className="text-[10px] md:text-xs uppercase font-bold tracking-widest">{logistics === 'drop-off' ? t('dropOff') : t('pickup')} {t('movementMethod')}</p>
                                <p className="text-[10px] md:text-[11px] text-text-dim mt-0.5 truncate">{address || t('walkInBoutique')}</p>
                             </div>
                          </div>
                       </div>

                       <div className="luxury-card">
                          <h4 className="text-[10px] uppercase tracking-widest text-text-dim mb-6 font-bold">{t('secureSettlement')}</h4>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded bg-gold/5 flex items-center justify-center border border-gold/20 flex-shrink-0">
                               <CreditCard className="text-gold w-5 h-5 md:w-6 md:h-6" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[10px] md:text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                                  {t('secureSettlement')}
                                  <span className="text-[8px] bg-gold text-luxury-black px-1 rounded">{t('secure')}</span>
                                </p>
                                <p className="text-[10px] md:text-[11px] text-text-dim mt-0.5">{t('chapaRedirect')}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="luxury-card flex flex-col justify-between bg-gold/5 border-gold/30 p-8 order-1 lg:order-2">
                       <div className="space-y-6">
                          <h4 className="text-[10px] uppercase tracking-widest text-text-dim mb-8 font-bold text-center border-b border-gold/20 pb-4">{t('manifestValuation')}</h4>
                          <div className="space-y-4">
                             <div className="flex justify-between text-xs md:text-sm text-text-dim">
                                <span>{t('restorationFee')} ({quantity}x)</span>
                                <span>{formatCurrency(subtotal, lang)}</span>
                             </div>
                             {logisticsFee > 0 && (
                                <div className="flex justify-between text-xs md:text-sm text-text-dim">
                                   <span>{t('logisticsFee')}</span>
                                   <span>{formatCurrency(logisticsFee, lang)}</span>
                                </div>
                             )}
                             {(referralDiscount > 0 || loyaltySavings > 0) && (
                               <div className="flex justify-between text-xs md:text-sm text-green-500 font-bold border-t border-luxury-border pt-4">
                                  <span className="flex items-center gap-1 uppercase tracking-tighter">{t('savingsApplied')}</span>
                                  <span>-{formatCurrency(referralDiscount + loyaltySavings, lang)}</span>
                                </div>
                             )}
                          </div>
                       </div>
                       <div className="pt-8 md:pt-10 border-t border-luxury-border mt-10">
                          <div className="flex justify-between items-end mb-8">
                             <div>
                                <p className="text-[8px] md:text-[10px] text-text-dim uppercase font-bold mb-1 tracking-widest">{t('grandTotal')}</p>
                                <p className="text-4xl md:text-6xl font-serif text-gold leading-none">{formatCurrency(total, lang)}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[8px] md:text-[10px] text-text-dim uppercase font-bold mb-1 tracking-widest">{t('earned')}</p>
                                <p className="text-base md:text-lg font-serif text-gold">+{Math.floor(total)} <span className="text-[8px] md:text-[10px] font-sans font-bold uppercase">{t('points')}</span></p>
                             </div>
                          </div>
                          <Button size="lg" onClick={placeOrder} isLoading={isSubmitting} className="w-full">
                            {paymentStatus === 'initializing' ? t('securingConnection') : t('confirmPay')}
                          </Button>
                       </div>
                    </div>
                 </div>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-20 px-10">
                 <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border border-gold/30 bg-gold/5 mb-10">
                    <CheckCircle2 className="w-10 h-10 text-gold" />
                 </div>
                 <h2 className="text-4xl md:text-6xl font-serif mb-6 tracking-tight">{t('manifestReceived')}</h2>
                 <p className="text-text-dim max-w-md mx-auto mb-16 italic text-xs md:text-sm leading-relaxed font-light">
                   {t('specialistsLogged')}
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {deferredPrompt && (
                      <Button variant="outline" onClick={installPWA} className="px-12 gap-2">
                        <Download className="w-4 h-4" /> {t('installApp')}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setView('history')} className="px-12">{t('viewArchive')}</Button>
                    <Button onClick={() => { setStep(0); setView('home'); setQuantity(1); setSelectedServices(['deep-cleaning']); setAddress(''); setCouponCode(''); setDiscountValue(0); setRedeemPoints(false); }} className="px-12">{t('newEngagement')}</Button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="h-16 border-t border-luxury-border flex items-center justify-center text-[10px] text-text-dim uppercase tracking-[0.4em] font-medium">
         © 2026 {t('brand')} 
      </footer>
    </div>
  );
}

function ReviewForm({ orderId, onSubmit, t }: { orderId: string, onSubmit: (oid: string, r: number, revText: string) => void, t: (key: any) => string }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <p className="text-gold text-xs italic">{t('reviewSubmitted')}</p>;

  return (
    <div className="space-y-6">
      <StarRating rating={rating} setRating={setRating} interactive />
      <textarea 
        className="w-full bg-transparent border border-luxury-border rounded p-4 text-xs placeholder:opacity-30 focus:outline-none focus:border-gold italic transition-all" 
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-main), transparent 95%)', color: 'var(--text-main)' }}
        placeholder={t('shareExperience')}
        rows={3}
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
      />
      <Button 
        size="md" 
        className="w-full"
        disabled={rating === 0 || loading} 
        onClick={async () => {
          setLoading(true);
          await onSubmit(orderId, rating, reviewText);
          setLoading(false);
          setSubmitted(true);
        }}
      >
        {t('submitEvaluation')}
      </Button>
    </div>
  );
}
