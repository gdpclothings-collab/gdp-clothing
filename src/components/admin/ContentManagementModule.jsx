import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Menu as MenuIcon,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  CheckCircle2,
  X,
  Save,
  Search,
  ExternalLink,
  Archive,
} from "lucide-react";
import { adminContentManagementApi } from "@/lib/adminContentManagementApi";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ContentManagementModule() {
  const [tab, setTab] = useState("pages");
  const [data, setData] = useState({
    pages: [],
    menus: [],
    products: [],
    collections: [],
  });
  const [pageEditor, setPageEditor] = useState(null);
  const [menuEditor, setMenuEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminContentManagementApi.load());
    } catch (err) {
      console.error("Content management load failed:", err);
      setError(err?.message || "Could not load content management.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const media = useMemo(
    () =>
      data.products.flatMap((product) =>
        (product.images || []).map((url, index) => ({
          id: `${product.id}-${index}`,
          productId: product.id,
          productName: product.name,
          url,
          primary: index === 0,
        }))
      ),
    [data.products]
  );

  const setPageStatus = async (page, status) => {
    try {
      await adminContentManagementApi.setPageStatus(page.id, status);
      showNotice(`${page.title} moved to ${status}.`);
      await load();
    } catch (err) {
      console.error("Page status update failed:", err);
      showNotice(err?.message || "Could not update page.");
    }
  };

  const setMenuActive = async (menu, active) => {
    try {
      await adminContentManagementApi.setMenuActive(menu.id, active);
      showNotice(`${menu.name} ${active ? "enabled" : "disabled"}.`);
      await load();
    } catch (err) {
      console.error("Menu status update failed:", err);
      showNotice(err?.message || "Could not update menu.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Metric label="Pages" value={data.pages.length} icon={FileText} />
        <Metric label="Menus" value={data.menus.length} icon={MenuIcon} />
        <Metric label="Product media" value={media.length} icon={ImageIcon} />
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#d5d5d5] bg-white p-1 w-fit">
          {[
            { id: "pages", label: "Pages", Icon: FileText },
            { id: "navigation", label: "Navigation", Icon: MenuIcon },
            { id: "media", label: "Media", Icon: ImageIcon },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-2 ${
                tab === id ? "bg-[#222] text-white" : "hover:bg-[#f5f5f5]"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 w-fit"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === "pages" && (
        <PagesTab
          pages={data.pages}
          loading={loading}
          onCreate={() => setPageEditor({ page: null })}
          onEdit={(page) => setPageEditor({ page })}
          onStatus={setPageStatus}
        />
      )}

      {tab === "navigation" && (
        <NavigationTab
          menus={data.menus}
          loading={loading}
          onCreate={() => setMenuEditor({ menu: null })}
          onEdit={(menu) => setMenuEditor({ menu })}
          onToggle={setMenuActive}
        />
      )}

      {tab === "media" && (
        <MediaTab media={media} loading={loading} />
      )}

      {pageEditor && (
        <PageEditor
          page={pageEditor.page}
          onClose={() => setPageEditor(null)}
          onSaved={async (message) => {
            setPageEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}

      {menuEditor && (
        <MenuEditor
          menu={menuEditor.menu}
          pages={data.pages}
          products={data.products}
          collections={data.collections}
          onClose={() => setMenuEditor(null)}
          onSaved={async (message) => {
            setMenuEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function PagesTab({ pages, loading, onCreate, onEdit, onStatus }) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pages;
    return pages.filter((page) =>
      [page.title, page.slug, page.page_type, page.excerpt]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [pages, search]);

  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="p-3 border-b border-[#e8e8e8] flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pages"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
          />
        </div>
        <button onClick={onCreate} className="md:ml-auto h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2">
          <Plus size={14} /> Create page
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs">
            <tr>
              <Th>Page</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Updated</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-[#777]">Loading pages…</td></tr>
            ) : visible.length ? (
              visible.map((page) => (
                <tr key={page.id} className="border-t border-[#eeeeee]">
                  <Td>
                    <button onClick={() => onEdit(page)} className="text-left">
                      <div className="font-semibold">{page.title}</div>
                      <div className="text-[11px] text-[#777]">/{page.slug}</div>
                    </button>
                  </Td>
                  <Td><span className="capitalize">{page.page_type}</span></Td>
                  <Td><PageStatus value={page.status} /></Td>
                  <Td>{formatDate(page.published_at)}</Td>
                  <Td>{formatDate(page.updated_at)}</Td>
                  <Td right>
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => onEdit(page)} className={secondaryButton}>Edit</button>
                      {page.status !== "published" ? (
                        <button onClick={() => onStatus(page, "published")} className={secondaryButton}>Publish</button>
                      ) : (
                        <button onClick={() => onStatus(page, "draft")} className={secondaryButton}>Unpublish</button>
                      )}
                      {page.status !== "archived" && (
                        <button onClick={() => onStatus(page, "archived")} className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs">
                          <Archive size={12} />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="py-12 text-center text-[#777]">No pages found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NavigationTab({ menus, loading, onCreate, onEdit, onToggle }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Navigation menus</div>
          <div className="text-xs text-[#777] mt-0.5">Header, footer and campaign navigation structures</div>
        </div>
        <button onClick={onCreate} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2">
          <Plus size={14} /> Create menu
        </button>
      </div>

      <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">Loading navigation…</div>
        ) : menus.length ? (
          menus.map((menu) => (
            <div key={menu.id} className="rounded-xl border border-[#e1e1e1] overflow-hidden">
              <div className="p-4 border-b border-[#eeeeee]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button onClick={() => onEdit(menu)} className="font-semibold text-left">{menu.name}</button>
                    <div className="text-[11px] text-[#777] mt-1">{menu.handle}</div>
                  </div>
                  <Status active={menu.active} />
                </div>
              </div>
              <div className="divide-y divide-[#eeeeee]">
                {(menu.navigation_items || []).slice(0, 7).map((item) => (
                  <div key={item.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[10px] text-[#888] capitalize">{item.link_type}</span>
                  </div>
                ))}
                {!(menu.navigation_items || []).length && (
                  <div className="px-4 py-4 text-xs text-[#888]">No menu items yet.</div>
                )}
              </div>
              <div className="p-3 border-t border-[#eeeeee] flex gap-2">
                <button onClick={() => onEdit(menu)} className={secondaryButton}>Edit</button>
                <button onClick={() => onToggle(menu, !menu.active)} className={secondaryButton}>
                  {menu.active ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">No navigation menus yet.</div>
        )}
      </div>
    </section>
  );
}

function MediaTab({ media, loading }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e8e8e8]">
        <div className="text-sm font-semibold">Product media library</div>
        <div className="text-xs text-[#777] mt-0.5">Images currently connected to the GDP product catalog</div>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">Loading media…</div>
        ) : media.length ? (
          media.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#e2e2e2] overflow-hidden bg-[#fafafa]">
              <a href={item.url} target="_blank" rel="noreferrer" className="block aspect-square bg-[#f1f1f1]">
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              </a>
              <div className="p-2">
                <div className="text-[11px] font-medium truncate">{item.productName}</div>
                <div className="text-[9px] text-[#888] mt-1 flex items-center justify-between">
                  <span>{item.primary ? "Primary" : "Gallery"}</span>
                  <ExternalLink size={10} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">No product media found.</div>
        )}
      </div>
    </section>
  );
}

function PageEditor({ page, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: page?.title || "",
    slug: page?.slug || "",
    pageType: page?.page_type || "page",
    excerpt: page?.excerpt || "",
    content: page?.body?.content || "",
    status: page?.status || "draft",
    seoTitle: page?.seo?.title || "",
    seoDescription: page?.seo?.description || "",
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminContentManagementApi.savePage(page?.id || null, {
        title: form.title,
        slug: slugify(form.slug || form.title),
        pageType: form.pageType,
        excerpt: form.excerpt,
        body: { ...(page?.body || {}), content: form.content },
        seo: {
          ...(page?.seo || {}),
          title: form.seoTitle || null,
          description: form.seoDescription || null,
        },
        status: form.status,
        publishedAt: page?.published_at || null,
      });
      await onSaved(page?.id ? "Page updated." : "Page created.");
    } catch (err) {
      console.error("Page save failed:", err);
      window.alert(err?.message || "Could not save page.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={page ? "Edit page" : "Create page"} onClose={onClose} onSave={save} saving={saving} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Title">
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
                slug: !page?.id && !current.slug ? slugify(event.target.value) : current.slug,
              }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="URL handle">
          <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Page type">
          <select value={form.pageType} onChange={(event) => setForm({ ...form, pageType: event.target.value })} className={inputClass}>
            <option value="page">Page</option>
            <option value="policy">Policy</option>
            <option value="landing">Landing page</option>
            <option value="faq">FAQ</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={inputClass}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <Field label="Excerpt">
        <textarea value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} className={textareaClass} rows={2} />
      </Field>

      <Field label="Page content" helper="Plain text / structured-content foundation">
        <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} className={textareaClass} rows={12} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="SEO title">
          <input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} className={inputClass} />
        </Field>
        <Field label="SEO description">
          <textarea value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} className={textareaClass} rows={3} />
        </Field>
      </div>
    </Editor>
  );
}

function MenuEditor({ menu, pages, products, collections, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: menu?.name || "",
    handle: menu?.handle || "",
    active: menu?.active !== false,
    items: (menu?.navigation_items || []).map((item) => ({
      label: item.label || "",
      linkType: item.link_type || "url",
      targetId: item.target_id || "",
      url: item.url || "",
      active: item.active !== false,
    })),
  });

  const addItem = () =>
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        { label: "", linkType: "url", targetId: "", url: "", active: true },
      ],
    }));

  const updateItem = (index, patch) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));

  const removeItem = (index) =>
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminContentManagementApi.saveMenu(menu?.id || null, {
        name: form.name,
        handle: slugify(form.handle || form.name),
        active: form.active,
      });

      await adminContentManagementApi.replaceMenuItems(
        saved.id,
        form.items.map((item) => {
          let url = item.url;
          let targetId = item.targetId || null;

          if (item.linkType === "page") {
            const target = pages.find((page) => page.id === item.targetId);
            url = target ? `/pages/${target.slug}` : null;
          } else if (item.linkType === "product") {
            const target = products.find((product) => product.id === item.targetId);
            url = target ? `/product/${target.id}` : null;
          } else if (item.linkType === "collection") {
            const target = collections.find((collection) => collection.id === item.targetId);
            url = target ? `/shop?collection=${encodeURIComponent(target.slug)}` : null;
          } else {
            targetId = null;
          }

          return { ...item, targetId, url };
        })
      );

      await onSaved(menu?.id ? "Navigation menu updated." : "Navigation menu created.");
    } catch (err) {
      console.error("Navigation save failed:", err);
      window.alert(err?.message || "Could not save navigation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={menu ? "Edit navigation menu" : "Create navigation menu"} onClose={onClose} onSave={save} saving={saving} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Menu name">
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                handle: !menu?.id && !current.handle ? slugify(event.target.value) : current.handle,
              }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Handle">
          <input value={form.handle} onChange={(event) => setForm({ ...form, handle: event.target.value })} className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-3 py-2">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
        Menu is active
      </label>

      <section className="rounded-xl border border-[#dedede] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8] bg-[#fafafa] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Menu items</div>
            <div className="text-xs text-[#777] mt-0.5">Items are saved in this order.</div>
          </div>
          <button onClick={addItem} className={secondaryButton}>
            <Plus size={13} /> Add item
          </button>
        </div>
        <div className="divide-y divide-[#eeeeee]">
          {form.items.map((item, index) => (
            <div key={index} className="p-3 bg-white grid lg:grid-cols-[1fr_.8fr_1.25fr_auto] gap-2 items-end">
              <Field label="Label">
                <input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Link type">
                <select
                  value={item.linkType}
                  onChange={(event) =>
                    updateItem(index, {
                      linkType: event.target.value,
                      targetId: "",
                      url: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="url">URL</option>
                  <option value="page">Page</option>
                  <option value="product">Product</option>
                  <option value="collection">Collection</option>
                </select>
              </Field>
              {item.linkType === "url" ? (
                <Field label="URL">
                  <input value={item.url} onChange={(event) => updateItem(index, { url: event.target.value })} className={inputClass} placeholder="/shop or https://…" />
                </Field>
              ) : (
                <Field label="Target">
                  <select value={item.targetId} onChange={(event) => updateItem(index, { targetId: event.target.value })} className={inputClass}>
                    <option value="">Choose target</option>
                    {(item.linkType === "page"
                      ? pages
                      : item.linkType === "product"
                        ? products
                        : collections
                    ).map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.title || target.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <button onClick={() => removeItem(index)} className="h-10 w-10 rounded-lg border border-red-200 bg-red-50 text-red-700 grid place-items-center">
                <X size={14} />
              </button>
            </div>
          ))}
          {!form.items.length && (
            <div className="p-5 text-sm text-[#777] text-center">No items yet.</div>
          )}
        </div>
      </section>
    </Editor>
  );
}

function Editor({ title, onClose, onSave, saving, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} bg-white rounded-2xl shadow-2xl overflow-hidden my-6`}>
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-[#e3e3e3] flex justify-end gap-2">
          <button onClick={onClose} className={secondaryButton}>Cancel</button>
          <button onClick={onSave} disabled={saving} className={primaryButton}>
            <Save size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function PageStatus({ value }) {
  const cls =
    value === "published"
      ? "bg-emerald-100 text-emerald-800"
      : value === "archived"
        ? "bg-[#eeeeee] text-[#555]"
        : "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${cls}`}>
      {value}
    </span>
  );
}

function Status({ active }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Field({ label, helper = null, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      {helper && <span className="ml-2 text-[10px] text-[#888]">{helper}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
const primaryButton = "h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40";
const secondaryButton = "h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-xs inline-flex items-center justify-center gap-1.5";
