import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Salad } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { PageBanner } from "@/components/PageBanner";
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

const Products = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", calories: "", protein: "", fat: "", carbs: "", category_id: "" });

  useEffect(() => {
    (async () => {
      try {
        if (!import.meta.env.DEV) return;
        const seededFlag = localStorage.getItem("seeded_products_v1");
        if (seededFlag) return;

        const catsCount = await getCountFromServer(query(collection(db, "product_categories")));
        const prodCount = await getCountFromServer(query(collection(db, "products")));
        if (catsCount.data().count > 0 || prodCount.data().count > 0) {
          localStorage.setItem("seeded_products_v1", "1");
          return;
        }

        const batch = writeBatch(db);
        const cats = [
          { id: "meat", name: "Мясо", icon: "🥩", sort_order: 10 },
          { id: "dairy", name: "Молочные", icon: "🥛", sort_order: 20 },
          { id: "grains", name: "Крупы", icon: "🌾", sort_order: 30 },
          { id: "fruits", name: "Фрукты", icon: "🍎", sort_order: 40 },
          { id: "vegetables", name: "Овощи", icon: "🥦", sort_order: 50 },
        ];
        cats.forEach((c) => {
          batch.set(doc(db, "product_categories", c.id), {
            name: c.name,
            icon: c.icon,
            sort_order: c.sort_order,
            created_at: serverTimestamp(),
          } as any);
        });
        await batch.commit();

        const productsSeed = [
          {
            name: "Куриная грудка",
            category_id: "meat",
            calories_per_100g: 165,
            protein_per_100g: 31,
            fat_per_100g: 3.6,
            carbs_per_100g: 0,
          },
          {
            name: "Творог 5%",
            category_id: "dairy",
            calories_per_100g: 121,
            protein_per_100g: 17,
            fat_per_100g: 5,
            carbs_per_100g: 3,
          },
          {
            name: "Овсянка (сухая)",
            category_id: "grains",
            calories_per_100g: 367,
            protein_per_100g: 13.5,
            fat_per_100g: 6.5,
            carbs_per_100g: 61,
          },
          {
            name: "Банан",
            category_id: "fruits",
            calories_per_100g: 89,
            protein_per_100g: 1.1,
            fat_per_100g: 0.3,
            carbs_per_100g: 22.8,
          },
          {
            name: "Огурец",
            category_id: "vegetables",
            calories_per_100g: 15,
            protein_per_100g: 0.7,
            fat_per_100g: 0.1,
            carbs_per_100g: 3.6,
          },
        ];

        await Promise.all(
          productsSeed.map((p) =>
            addDoc(collection(db, "products"), {
              ...p,
              is_approved: true,
              created_at: serverTimestamp(),
              approved_at: serverTimestamp(),
            } as any)
          )
        );

        await setDoc(doc(db, "meta", "seed"), { seeded_products_v1: true, updated_at: serverTimestamp() } as any, {
          merge: true,
        });

        localStorage.setItem("seeded_products_v1", "1");
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const catsQ = query(collection(db, "product_categories"), orderBy("sort_order"));
    const unsubCats = onSnapshot(
      catsQ,
      (snap) => {
        const cats: Category[] = [];
        snap.forEach((d) => cats.push({ id: d.id, ...(d.data() as any) }));
        setCategories(cats);
        setLoadingCats(false);
      },
      (e) => {
        setCategories([]);
        setLoadingCats(false);
        toast({ variant: "destructive", title: "Категории не загружены", description: (e as any)?.message ?? "Ошибка" });
      }
    );

    // Avoid composite index requirements; sort client-side.
    const productsQ = query(collection(db, "products"), where("is_approved", "==", true));
    const unsubProducts = onSnapshot(
      productsQ,
      (snap) => {
        const rows: Product[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        rows.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "ru"));
        setProducts(rows);
        setLoadingProducts(false);
      },
      (e) => {
        setProducts([]);
        setLoadingProducts(false);
        toast({ variant: "destructive", title: "Продукты не загружены", description: (e as any)?.message ?? "Ошибка" });
      }
    );

    return () => {
      unsubCats();
      unsubProducts();
    };
  }, []);

  const filtered = products.filter(
    (p) =>
      (activeCat === "all" || p.category_id === activeCat) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddProduct = async () => {
    if (!user || !newProduct.name || !newProduct.calories) return;
    try {
      await addDoc(collection(db, "products"), {
        name: newProduct.name,
        calories_per_100g: parseFloat(newProduct.calories),
        protein_per_100g: parseFloat(newProduct.protein || "0"),
        fat_per_100g: parseFloat(newProduct.fat || "0"),
        carbs_per_100g: parseFloat(newProduct.carbs || "0"),
        category_id: newProduct.category_id || null,
        added_by: user.uid,
        is_approved: false,
        created_at: serverTimestamp(),
      });

      toast({ title: "Продукт отправлен на модерацию!" });
      setAddOpen(false);
      setNewProduct({ name: "", calories: "", protein: "", fat: "", carbs: "", category_id: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PageBanner
        eyebrow="Каталог"
        title="Найди продукт за секунды"
        description="Поиск, категории и добавление своих продуктов на модерацию."
        icon={<Salad className="h-5 w-5 text-primary-foreground" />}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold">Каталог</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm"><Plus className="h-4 w-4 mr-1" /> Добавить</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новый продукт</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select value={newProduct.category_id} onValueChange={(v) => setNewProduct({ ...newProduct, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Ккал/100г</Label>
                  <Input type="number" value={newProduct.calories} onChange={(e) => setNewProduct({ ...newProduct, calories: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Белки</Label>
                  <Input type="number" value={newProduct.protein} onChange={(e) => setNewProduct({ ...newProduct, protein: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Жиры</Label>
                  <Input type="number" value={newProduct.fat} onChange={(e) => setNewProduct({ ...newProduct, fat: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Углеводы</Label>
                  <Input type="number" value={newProduct.carbs} onChange={(e) => setNewProduct({ ...newProduct, carbs: e.target.value })} />
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={handleAddProduct}>Отправить на модерацию</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск продуктов..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          <CarouselItem className="basis-auto">
            <Badge
              variant={activeCat === "all" ? "default" : "secondary"}
              className="cursor-pointer shrink-0"
              onClick={() => setActiveCat("all")}
            >
              Все
            </Badge>
          </CarouselItem>
          {categories.map((cat) => (
            <CarouselItem key={cat.id} className="basis-auto">
              <Badge
                variant={activeCat === cat.id ? "default" : "secondary"}
                className="cursor-pointer shrink-0"
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.icon} {cat.name}
              </Badge>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
            <Card className="card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-2xl font-display font-bold text-primary mt-1">{p.calories_per_100g} <span className="text-xs text-muted-foreground font-normal">ккал/100г</span></p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-chart-protein" /> Б {p.protein_per_100g}г</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-chart-fat" /> Ж {p.fat_per_100g}г</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-chart-carbs" /> У {p.carbs_per_100g}г</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      {filtered.length === 0 && (loadingCats || loadingProducts) && (
        <p className="text-center text-muted-foreground py-8">Загрузка...</p>
      )}
      {filtered.length === 0 && !(loadingCats || loadingProducts) && (
        <p className="text-center text-muted-foreground py-8">Продукты не найдены</p>
      )}

      <div className="fixed left-0 right-0 z-40 bottom-20 md:bottom-6">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-surface elevated border border-border/60 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Подбор</p>
                <p className="text-sm font-medium truncate">
                  Найдено: {filtered.length} • Категория: {activeCat === "all" ? "все" : "выбрана"}
                </p>
              </div>

              <Button
                variant="hero"
                className="h-11 px-4 rounded-xl"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Добавить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Products;
