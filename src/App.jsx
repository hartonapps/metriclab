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
  WandSparkles,
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

  useEffect(() => {
    const hidden = localStorage.getItem('metriclabs-onboarding-hidden') === '1';
    setShowOnboarding(!hidden);
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
      const profileRef = doc(db, 'admin_users', nextUser.uid);
      const profile = await getDoc(profileRef);
      setIsAdmin(profile.exists() && profile.data().role === 'admin');
      setAdminLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoadingProducts(false);
      return undefined;
    }

    const productsQuery = query(collection(db, 'products'), orderBy('order', 'asc'));
    const unsub = onSnapshot(productsQuery, (snapshot) => {
      const nextProducts = snapshot.docs.map((item, idx) => ({ id: item.id, ...item.data(), order: item.data().order ?? idx }));
      setProducts(nextProducts);
      setLoadingProducts(false);
    });
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
    const timer = setTimeout(() => setToast(null), 2800);
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
        await addDoc(collection(db, 'products'), { ...payload, order: products.length, createdAt: serverTimestamp() });
        showMessage('Product created!');
      }
      resetForm();
    } catch {
      showMessage('Could not save product. Check Firebase rules.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (product) => {
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
  };

  const toggleVisibility = async (product) => {
    await updateDoc(doc(db, 'products', product.id), { visible: !product.visible });
    showMessage(`Product ${product.visible ? 'hidden' : 'visible'}`);
  };

  const moveProduct = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= products.length) return;
    const itemA = products[index];
    const itemB = products[nextIndex];
    await Promise.all([
      updateDoc(doc(db, 'products', itemA.id), { order: itemB.order }),
      updateDoc(doc(db, 'products', itemB.id), { order: itemA.order }),
    ]);
  };

  const shareProduct = async (product) => {
    const message = `Check out ${product.name} from Metric Labs: ${buildWhatsAppLink(product.name)}`;
    if (navigator.share) {
      await navigator.share({ title: product.name, text: message });
    } else {
      await navigator.clipboard.writeText(message);
      showMessage('Share text copied to clipboard');
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

  const signInAdmin = () => {
    if (!firebaseConfigured) {
      showMessage('Configure Firebase environment variables to enable admin login.');
      return;
    }
    signInWithPopup(auth, googleProvider);
  };

  const onboardingDismiss = () => {
    localStorage.setItem('metriclabs-onboarding-hidden', '1');
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm text-brand-600">🛠 Metric Labs</p>
            <h1 className="text-lg font-semibold">Shopify Tools Showcase</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="rounded-full border p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="toggle dark mode">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <button onClick={() => signOut(auth)} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={16} />Logout</button>
            ) : (
              <button onClick={signInAdmin} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-3 py-2 text-sm font-medium text-white"><LogIn size={16} />Admin Login</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!firebaseConfigured ? (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Firebase config is missing. Add the required environment variables to enable products/admin features.
            <br />
            Missing: {firebaseMissingVars.join(', ')}
          </div>
        ) : null}

        <section className="mb-6 rounded-3xl bg-gradient-to-br from-brand-100 to-white p-6 shadow-soft dark:from-brand-900 dark:to-slate-900">
          <p className="mb-2 text-sm text-brand-600">Instagram: @metriclab</p>
          <h2 className="text-2xl font-semibold">Powerful Shopify Tools to Scale Effortlessly</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">No checkout required — request any tool via WhatsApp and our team will assist you personally.</p>
        </section>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search tools..." className="w-full rounded-full border border-slate-300 bg-white px-10 py-2 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tags.map((tag) => (
              <button key={tag} onClick={() => setSelectedTag(tag)} className={`rounded-full px-4 py-2 text-sm ${selectedTag === tag ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{tag}</button>
            ))}
          </div>
        </div>

        {loadingProducts ? <p className="flex items-center gap-2 text-sm"><Loader className="animate-spin" size={16} />Loading products...</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {visibleProducts.map((product) => (
              <motion.article key={product.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileHover={{ y: -4 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
                <img src={product.images?.[0] || 'https://placehold.co/640x360?text=Metric+Labs'} alt={product.name} className="h-48 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{product.name}</h3>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-900 dark:bg-brand-900 dark:text-brand-100">{product.price}</span>
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{product.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {(product.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">#{tag}</span>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={buildWhatsAppLink(product.name)} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-brand-500 px-3 py-2 text-sm font-medium text-white"><MessageCircle size={15} />Buy Now</a>
                    <button onClick={() => shareProduct(product)} className="rounded-full border p-2"><Share2 size={15} /></button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        <FloatingWhatsApp />

        {adminLoading ? null : isAdmin ? (
          <section className="mt-10 space-y-5 rounded-3xl border border-brand-200 bg-white p-5 dark:border-brand-900 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><BadgeCheck className="text-brand-500" />Admin Panel</h3>
            <form onSubmit={handleSaveProduct} className="grid gap-3 md:grid-cols-2">
              <input value={formState.name} onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))} placeholder="Product Name" className="rounded-xl border p-2 dark:bg-slate-950" />
              <input value={formState.price} onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))} placeholder="Price (display only)" className="rounded-xl border p-2 dark:bg-slate-950" />
              <input value={formState.tags} onChange={(e) => setFormState((prev) => ({ ...prev, tags: e.target.value }))} placeholder="Tags (comma separated)" className="rounded-xl border p-2 dark:bg-slate-950 md:col-span-2" />
              <textarea value={formState.description} onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description with emojis ✨" className="min-h-28 rounded-xl border p-2 dark:bg-slate-950 md:col-span-2" />
              <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} className="rounded-xl border p-2 dark:bg-slate-950 md:col-span-2" />
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={formState.visible} onChange={(e) => setFormState((prev) => ({ ...prev, visible: e.target.checked }))} />Visible product</label>
              <div className="flex items-center gap-2 md:justify-end">
                <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm text-white">{uploading ? <Loader className="animate-spin" size={15} /> : <Plus size={15} />}{editingProduct ? 'Update' : 'Publish'} Product</button>
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
        ) : user ? <p className="mt-8 text-sm text-amber-600">Signed in but no admin role. Add your uid to admin_users with role=admin.</p> : null}
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 right-4 rounded-full bg-slate-900 px-4 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900">{toast}</motion.div>
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
