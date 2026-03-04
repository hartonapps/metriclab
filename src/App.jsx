import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Eye,
  EyeOff,
  Instagram,
  Loader,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Share2,
  Sun,
  Trash2,
  TriangleAlert,
  WandSparkles,
  WifiOff,
} from 'lucide-react';
import { auth, db, firebaseConfigured, firebaseMissingVars, googleProvider, storage } from './firebase';
import { useDarkMode } from './hooks/useDarkMode';

const WHATSAPP = '18255950642';
const firstForm = { name: '', description: '', price: '', tags: '', visible: true };

function App() {
  const { darkMode, setDarkMode } = useDarkMode();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [toast, setToast] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [formState, setFormState] = useState(firstForm);
  const [uploading, setUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const hidden = localStorage.getItem('metriclabs-onboarding-hidden') === '1';
    setShowOnboarding(!hidden);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setNetworkOnline(true);
      showMessage('Back online ✅');
    };
    const goOffline = () => {
      setNetworkOnline(false);
      showMessage('You are offline. Firebase features are temporarily unavailable.');
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setAdminLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, 'admin_users', nextUser.uid);
        const profile = await getDoc(profileRef);
        setIsAdmin(profile.exists() && profile.data().role === 'admin');
      } catch {
        showMessage('Could not verify admin role. Check network and Firestore rules.');
      } finally {
        setAdminLoading(false);
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoadingProducts(false);
      return undefined;
    }

    const productsQuery = query(collection(db, 'products'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      productsQuery,
      (snapshot) => {
        const nextProducts = snapshot.docs.map((item, idx) => ({
          id: item.id,
          ...item.data(),
          order: item.data().order ?? idx,
        }));
        setProducts(nextProducts);
        setLoadingProducts(false);
      },
      () => {
        setLoadingProducts(false);
        showMessage('Live product sync failed. Please check your internet connection.');
      }
    );

    return unsub;
  }, []);

  const tags = useMemo(() => {
    const allTags = new Set();
    products.forEach((product) => (product.tags || []).forEach((tag) => allTags.add(tag)));
    return ['all', ...Array.from(allTags)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    return products.filter((product) => {
      if (!product.visible) return false;
      const matchSearch =
        !normalized ||
        product.name?.toLowerCase().includes(normalized) ||
        product.description?.toLowerCase().includes(normalized) ||
        product.tags?.join(' ').toLowerCase().includes(normalized);
      const matchTag = selectedTag === 'all' || product.tags?.includes(selectedTag);
      return matchSearch && matchTag;
    });
  }, [products, queryText, selectedTag]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showMessage = (msg) => setToast(msg);

  const resetForm = () => {
    setEditingProduct(null);
    setFormState(firstForm);
    setImageFiles([]);
  };

  const uploadImages = async () => {
    if (!imageFiles.length) return editingProduct?.images || [];
    const uploads = imageFiles.map(async (file) => {
      const fileRef = ref(storage, `products/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      return getDownloadURL(fileRef);
    });
    return Promise.all(uploads);
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    if (!formState.name.trim()) return showMessage('Product name is required.');
    if (!formState.price.trim()) return showMessage('Price is required.');
    setUploading(true);
    try {
      const uploadedImages = await uploadImages();
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        price: formState.price.trim(),
        tags: formState.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        images: editingProduct ? [...(editingProduct.images || []), ...uploadedImages] : uploadedImages,
        visible: formState.visible,
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
        showMessage('Product updated!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          order: products.length,
          createdAt: serverTimestamp(),
        });
        showMessage('Product created!');
      }
      resetForm();
    } catch {
      showMessage('Could not save product. Check internet + Firebase rules.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (product) => {
    try {
      await deleteDoc(doc(db, 'products', product.id));
      await Promise.all((product.images || []).map(async (url) => {
        try {
          await deleteObject(ref(storage, url));
        } catch {
          return null;
        }
        return null;
      }));
      showMessage('Product deleted');
    } catch {
      showMessage('Delete failed. Try again when online.');
    }
  };

  const toggleVisibility = async (product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), { visible: !product.visible });
      showMessage(`Product ${product.visible ? 'hidden' : 'visible'}`);
    } catch {
      showMessage('Visibility update failed.');
    }
  };

  const moveProduct = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= products.length) return;
    const itemA = products[index];
    const itemB = products[nextIndex];
    try {
      await Promise.all([
        updateDoc(doc(db, 'products', itemA.id), { order: itemB.order }),
        updateDoc(doc(db, 'products', itemB.id), { order: itemA.order }),
      ]);
    } catch {
      showMessage('Reorder failed. Please retry.');
    }
  };

  const shareProduct = async (product) => {
    const message = `Check out ${product.name} from Metric Labs: ${buildWhatsAppLink(product.name)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: message });
      } else {
        await navigator.clipboard.writeText(message);
        showMessage('Share text copied to clipboard');
      }
    } catch {
      showMessage('Share cancelled');
    }
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormState({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      tags: (product.tags || []).join(', '),
      visible: product.visible ?? true,
    });
  };

  const signInAdmin = async () => {
    if (!firebaseConfigured) {
      showMessage('Configure Firebase environment variables to enable admin login.');
      return;
    }

    if (!networkOnline) {
      showMessage('You are offline. Reconnect internet to open admin login.');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      showMessage('Admin login failed (network/popup blocked). Please retry.');
    }
  };

  const onboardingDismiss = () => {
    localStorage.setItem('metriclabs-onboarding-hidden', '1');
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Metric Labs</p>
            <h1 className="text-lg font-semibold">Shopify Tools Showcase</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="rounded-full border border-slate-300/80 bg-white p-2 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" aria-label="toggle dark mode">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <button onClick={() => signOut(auth)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"><LogOut size={16} />Logout</button>
            ) : (
              <button onClick={signInAdmin} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-600"><LogIn size={16} />Admin Login</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!networkOnline ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff size={14} /> You are offline. Admin auth and live Firestore updates may fail.
          </div>
        ) : null}

        {!firebaseConfigured ? (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="mb-1 inline-flex items-center gap-2 font-medium"><TriangleAlert size={14} />Firebase config is incomplete.</p>
            <p className="text-xs">Missing: {firebaseMissingVars.join(', ')}</p>
          </div>
        ) : null}

        <section className="mb-6 overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-100 via-white to-white p-6 shadow-soft dark:border-brand-950 dark:from-brand-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-medium text-brand-700 dark:text-brand-200">Instagram: @metriclab</p>
              <h2 className="text-2xl font-bold leading-tight sm:text-3xl">Professional Shopify Tools to Boost Sales & Performance</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No online checkout — choose your tool and request directly via WhatsApp for fast manual assistance.</p>
            </div>
            <a href={buildWhatsAppLink('a Shopify tool')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600">
              <MessageCircle size={16} /> Chat on WhatsApp
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {[
              ['Fast delivery', 'Direct support via WhatsApp'],
              ['Admin-ready', 'Realtime Firebase management'],
              ['Designed for growth', 'Curated Shopify tool stack'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
                <p className="mt-1 font-semibold">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tool Catalog</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mobile-first • Lightweight • Professional UI</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search tools..." className="w-full rounded-full border border-slate-300 bg-white px-10 py-2.5 shadow-sm outline-none ring-brand-300 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tags.map((tag) => (
              <button key={tag} onClick={() => setSelectedTag(tag)} className={`rounded-full px-4 py-2 text-sm transition ${selectedTag === tag ? 'bg-brand-500 text-white shadow-soft' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700'}`}>{tag}</button>
            ))}
          </div>
        </div>

        {loadingProducts ? <p className="flex items-center gap-2 text-sm"><Loader className="animate-spin" size={16} />Loading products...</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {visibleProducts.map((product) => (
              <motion.article key={product.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileHover={{ y: -6 }} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
                <img src={product.images?.[0] || 'https://placehold.co/640x360?text=Metric+Labs'} alt={product.name} className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{product.name}</h3>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-900 dark:bg-brand-900 dark:text-brand-100">{product.price}</span>
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{product.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {(product.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">#{tag}</span>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={buildWhatsAppLink(product.name)} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"><MessageCircle size={15} />Buy Now</a>
                    <button onClick={() => shareProduct(product)} className="rounded-full border border-slate-300 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Share2 size={15} /></button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        {!loadingProducts && visibleProducts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
            No products match your current search or filter.
          </div>
        ) : null}

        <FloatingWhatsApp />

        {adminLoading ? null : isAdmin ? (
          <section className="mt-10 space-y-5 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-900 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><BadgeCheck className="text-brand-500" />Admin Panel</h3>
            <form onSubmit={handleSaveProduct} className="grid gap-3 md:grid-cols-2">
              <input value={formState.name} onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))} placeholder="Product Name" className="rounded-xl border p-2.5 dark:bg-slate-950" />
              <input value={formState.price} onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))} placeholder="Price (display only)" className="rounded-xl border p-2.5 dark:bg-slate-950" />
              <input value={formState.tags} onChange={(e) => setFormState((prev) => ({ ...prev, tags: e.target.value }))} placeholder="Tags (comma separated)" className="rounded-xl border p-2.5 dark:bg-slate-950 md:col-span-2" />
              <textarea value={formState.description} onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description with emojis ✨" className="min-h-28 rounded-xl border p-2.5 dark:bg-slate-950 md:col-span-2" />
              <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} className="rounded-xl border p-2.5 dark:bg-slate-950 md:col-span-2" />
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={formState.visible} onChange={(e) => setFormState((prev) => ({ ...prev, visible: e.target.checked }))} />Visible product</label>
              <div className="flex items-center gap-2 md:justify-end">
                <button type="submit" disabled={uploading || !networkOnline} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{uploading ? <Loader className="animate-spin" size={15} /> : <Plus size={15} />}{editingProduct ? 'Update' : 'Publish'} Product</button>
                {(editingProduct || formState.name || formState.description) ? <button type="button" onClick={resetForm} className="rounded-full border px-3 py-2 text-sm">Cancel</button> : null}
              </div>
            </form>

            <AdminPreview formState={formState} imageFiles={imageFiles} />

            <div className="space-y-2">
              {products.map((product, index) => (
                <div key={product.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <p className="mr-auto text-sm font-medium">{product.name}</p>
                  <button onClick={() => moveProduct(index, -1)} className="rounded-full border p-2" disabled={!index}><ArrowUp size={14} /></button>
                  <button onClick={() => moveProduct(index, 1)} className="rounded-full border p-2" disabled={index === products.length - 1}><ArrowDown size={14} /></button>
                  <button onClick={() => toggleVisibility(product)} className="rounded-full border p-2">{product.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button onClick={() => startEdit(product)} className="rounded-full border px-3 py-2 text-xs">Edit</button>
                  <button onClick={() => handleDelete(product)} className="rounded-full border p-2 text-rose-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>
        ) : user ? (
          <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Signed in but no admin role. Add your UID to `admin_users/{'{uid}'}` with `role = admin`.</p>
        ) : null}
      </main>

      <footer className="mt-12 border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <p>Metric Labs | Shopify Tools Hub</p>
        <p className="mt-1 inline-flex items-center gap-1"><Instagram size={15} />@metriclab</p>
        <p className="mx-auto mt-3 max-w-3xl text-xs">Users are responsible for complying with applicable laws. Metric Labs is not liable for misuse of Shopify tools requested via WhatsApp.</p>
      </footer>

      <AnimatePresence>
        {showOnboarding ? <Onboarding onClose={onboardingDismiss} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 right-4 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">{toast}</motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AdminPreview({ formState, imageFiles }) {
  const img = imageFiles[0] ? URL.createObjectURL(imageFiles[0]) : 'https://placehold.co/640x360?text=Preview';
  return (
    <div className="rounded-2xl border border-dashed border-brand-300 p-4">
      <h4 className="mb-2 text-sm font-medium">Preview before publish</h4>
      <div className="max-w-sm overflow-hidden rounded-2xl border">
        <img src={img} alt="preview" className="h-40 w-full object-cover" />
        <div className="p-3">
          <p className="font-semibold">{formState.name || 'Product Name'}</p>
          <p className="text-sm text-slate-500">{formState.description || 'Description preview with emojis ✨'}</p>
          <p className="mt-2 text-sm font-medium text-brand-600">{formState.price || '$00.00'}</p>
          <p className="mt-2 text-xs">WhatsApp Preview: I want to buy {formState.name || 'Product Name'}</p>
        </div>
      </div>
    </div>
  );
}

function Onboarding({ onClose }) {
  const slides = [
    'Welcome to Metric Labs — discover Shopify tools built to grow your store.',
    'Tap Buy Now on any product and WhatsApp opens with your pre-filled request.',
    'Use filters, dark mode, and the floating support button for a better mobile experience.',
  ];
  const [index, setIndex] = useState(0);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-slate-900">
        <p className="mb-2 inline-flex items-center gap-2 text-brand-600"><WandSparkles size={16} />Quick onboarding</p>
        <p>{slides[index]}</p>
        <div className="mt-5 flex justify-between">
          <button onClick={onClose} className="text-sm text-slate-500">Skip</button>
          <div className="flex gap-2">
            {index < slides.length - 1 ? <button onClick={() => setIndex((v) => v + 1)} className="rounded-full bg-brand-500 px-4 py-2 text-sm text-white">Next</button> : <button onClick={onClose} className="rounded-full bg-brand-500 px-4 py-2 text-sm text-white">Start</button>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FloatingWhatsApp() {
  return (
    <a href={buildWhatsAppLink('a Shopify tool')} target="_blank" rel="noreferrer" className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-medium text-white shadow-soft">
      <MessageCircle size={17} />Support
    </a>
  );
}

function buildWhatsAppLink(productName) {
  const text = encodeURIComponent(`I want to buy ${productName}`);
  return `https://wa.me/${WHATSAPP}?text=${text}`;
}

export default App;
