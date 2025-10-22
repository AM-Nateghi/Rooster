# 📐 CSS Architecture - Rooster Project

## 🎯 Design Philosophy
این پروژه از **Tailwind-First Approach** استفاده می‌کند:
- حداکثر استفاده از Tailwind utility classes در HTML
- CSS سفارشی فقط برای استایل‌هایی که در Tailwind وجود ندارند

---

## 📁 File Structure

```
assets/
├── shared.css      # کامپوننت‌های مشترک بین همه صفحات و فونت‌ها
├── style.css       # استایل‌های اختصاصی صفحه index.html
└── graph.css       # استایل‌های اختصاصی صفحه graph.html
```

---

## 🗂️ File Purposes

### ۱. `shared.css` - Shared Components
کامپوننت‌هایی که در Tailwind وجود ندارند و در همه صفحات استفاده می‌شوند:

- ✨ **Glassmorphism**: `.glass`, `.glass-card`
- 🎨 **Background Gradients**: `body:not(.dark)`

### ۲. `style.css` - Index Page Specific
استایل‌های اختصاصی صفحه اصلی:

- 🏷️ **Active Tab**: `.active-tab`
- 👁️ **Progressive Disclosure**: `.tab .tab-rename-icon`
- 🎯 **Selected Card**: `.selected-card`
- 📜 **Custom Scrollbar**: `#tabs::-webkit-scrollbar`

### ۳. `graph.css` - Graph Page Specific
استایل‌های مخصوص D3.js و گراف:

- 🔵 **D3 Nodes**: `.node`, `.node circle`
- 🔗 **D3 Links**: `.link`, `.link.undirected`
- 🏷️ **Node Labels**: `.node-label`
- 💬 **Tooltips**: `#detailTooltip`
- 📜 **Custom Scrollbar**: `::-webkit-scrollbar`

---

## 🚫 What NOT to Add to CSS

این موارد **نباید** در CSS نوشته شوند، چون در Tailwind موجودند:

❌ Colors → استفاده از `bg-{color}-{shade}`, `text-{color}-{shade}`
❌ Spacing → استفاده از `p-{n}`, `m-{n}`, `gap-{n}`
❌ Typography → استفاده از `text-{size}`, `font-{weight}`
❌ Flexbox/Grid → استفاده از `flex`, `grid`, `items-center`
❌ Borders → استفاده از `border`, `rounded-{size}`
❌ Shadows → استفاده از `shadow-{size}`
❌ Dark Mode → استفاده از `dark:{utility}`

---

## ✅ When to Add Custom CSS

فقط در این موارد CSS سفارشی بنویسید:

1. **Glassmorphism** - `backdrop-filter` در Tailwind CDN محدود است
2. **Complex Gradients** - gradientهای چند رنگ پیچیده
3. **Custom Animations** - انیمیشن‌های پیچیده با keyframes
4. **Third-party Libraries** - استایل‌های D3.js، Chart.js و...
5. **Complex Pseudo-selectors** - مثل `::-webkit-scrollbar`
6. **Progressive Disclosure** - پترن‌های UX خاص

---

## 🔧 Tailwind Configuration

هر دو HTML نیاز به این تنظیم دارند:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        darkMode: 'class'
    }
</script>
```

**دلیل**: بدون این تنظیم، `dark:*` classes کار نمی‌کنند.

---

## 🎨 Dark Mode Strategy

### در HTML (با Tailwind):
```html
<div class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
```

### در CSS (فقط برای custom components):
```css
.glass { background: rgba(255, 252, 245, 0.82); }
.dark .glass { background: rgba(30, 41, 59, 0.6); }
```

---

## 📦 Load Order

```html
<link rel="stylesheet" href="assets/public.css">    <!-- 1. Fonts -->
<link rel="stylesheet" href="assets/shared.css">   <!-- 2. Shared components -->
<link rel="stylesheet" href="assets/style.css">    <!-- 3. Page specific -->
```

این ترتیب تضمین می‌کند که:
1. فونت‌ها اول لود شوند
2. کامپوننت‌های مشترک قبل از page-specific
3. Page-specific می‌تواند shared را override کند (در صورت نیاز)

---

## ⚠️ Anti-Patterns to Avoid

### ❌ Bad: Duplicate Styles
```css
/* در style.css */
.glass { ... }

/* در graph.css */
.glass { ... }  /* تکرار! */
```

### ✅ Good: DRY Principle
```css
/* در shared.css */
.glass { ... }
```

### ❌ Bad: Fighting Tailwind
```css
body { background: #1e293b !important; }  /* تداخل با Tailwind */
```

### ✅ Good: Complement Tailwind
```html
<body class="bg-gray-100 dark:bg-slate-900">
```

---

## 🔍 Debugging Dark Mode Issues

اگر dark mode در Chrome ویندوز کار نکرد:

1. ✅ بررسی کنید `tailwind.config.darkMode = 'class'` تنظیم شده باشد
2. ✅ بررسی کنید کلاس `.dark` به `<body>` اضافه شود
3. ✅ F12 → Elements → `<body>` را چک کنید
4. ✅ Computed styles را بررسی کنید

---

## 📊 CSS Size Optimization

- `public.css`: ~500 bytes (فقط font)
- `shared.css`: ~1 KB (glassmorphism)
- `style.css`: ~800 bytes (index specific)
- `graph.css`: ~2 KB (D3.js styles)

**Total**: ~4.3 KB CSS سفارشی (بسیار کم!)

باقی همه چیز با Tailwind مدیریت می‌شود.

---

## 🚀 Future Improvements

اگر پروژه بزرگ‌تر شد:

1. استفاده از **Tailwind CLI** به جای CDN
2. اضافه کردن custom utilities به `tailwind.config.js`
3. استفاده از **PostCSS** برای بهینه‌سازی
4. اضافه کردن **PurgeCSS** برای حذف unused styles

---

**Updated**: 2025-10-22
**Author**: Rooster Development Team
