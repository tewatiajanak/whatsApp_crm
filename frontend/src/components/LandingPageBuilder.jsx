import React, { useState, useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";
import { workflowConfigApi } from "../api";
import { Spinner, Modal } from "./ui";

// Core element types available in the visual builder
import { COMPONENT_TYPES } from "./BuilderComponentTypes";


export default function LandingPageBuilder({ initialPage, formsList, onSave, onCancel }) {
  const toast = useToast();
  const [page, setPage] = useState(() => ({
    _id: initialPage?._id || `page-${Date.now()}`,
    name: initialPage?.name || "New Visual Landing Page",
    brandName: initialPage?.brandName || "Brand",
    pageType: initialPage?.pageType || "enquiry",
    canvasWidth: initialPage?.canvasWidth || "100%",
    isActive: initialPage?.isActive !== false,
    theme: initialPage?.theme || {
      primaryColor: "#2249b7",
      secondaryColor: "#4f46e5",
      fontFamily: "Inter",
      borderRadius: "12px",
      backgroundColor: "#f8fafc"
    },
    seo: initialPage?.seo || {
      title: "Landing Page | Admissions Open",
      description: "Join one of the best academies in the region.",
      keywords: "admissions, school, landing page"
    },
    components: initialPage?.components || []
  }));

  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // States
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [viewportMode, setViewportMode] = useState("desktop");
  const [activeCategory, setActiveCategory] = useState("presets");
  const [rightTab, setRightTab] = useState("Content");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewViewport, setPreviewViewport] = useState("desktop");
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [customHtmlCode, setCustomHtmlCode] = useState("");
  const [editorMode, setEditorMode] = useState("visual");
  const [htmlSourceCode, setHtmlSourceCode] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [enquiryFormsList, setEnquiryFormsList] = useState([]);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(null);
  const [draggableId, setDraggableId] = useState(null);
  const [isDraggingActive, setIsDraggingActive] = useState(false);
  const [activeDragOverIndex, setActiveDragOverIndex] = useState(null);

  const handleDragOverComponent = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isUpperHalf = relativeY < rect.height / 2;

    const targetIdx = isUpperHalf ? index : index + 1;
    if (activeDragOverIndex !== targetIdx) {
      setActiveDragOverIndex(targetIdx);
    }
  };

  const handleDropOnComponent = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData("element-type");
    const dragIdxStr = e.dataTransfer.getData("drag-index");

    if (activeDragOverIndex !== null) {
      handleDropItem(activeDragOverIndex, type, dragIdxStr);
    }
    setActiveDragOverIndex(null);
    setIsDraggingActive(false);
  };

  const handleDragLeaveCanvas = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setActiveDragOverIndex(null);
    }
  };

  // Simple inquiry preview mockup values
  const [previewFormValues, setPreviewFormValues] = useState({ name: "", email: "", phone: "", msg: "" });
  const [hoveredPresetItem, setHoveredPresetItem] = useState(null);
  const presetTimeoutRef = useRef(null);

  // States & Refs for canvas resizing by picking corners/edges
  const [resizing, setResizing] = useState(null); // { compId, direction, startX, startY, startWidth, startHeight, startPaddingTop, startPaddingBottom }
  const latestPageRef = useRef(page);
  const canvasRef = useRef(null);
  useEffect(() => {
    latestPageRef.current = page;
  }, [page]);

  useEffect(() => {
    const topbarTitleEl = document.querySelector(".topbar h2");
    if (topbarTitleEl) {
      const originalHTML = topbarTitleEl.innerHTML;
      
      topbarTitleEl.innerHTML = `
        <div class="d-flex align-items-center gap-1 text-muted fw-normal" style="font-size: 13px;">
          <span class="text-primary cursor-pointer hover-underline" id="breadcrumb-setup-link" style="font-weight: 600; cursor: pointer; text-decoration: none;">Setup</span>
          <i class="bi bi-chevron-double-right text-muted mx-1" style="font-size: 10px; -webkit-text-stroke: 0.75px #64748b; font-weight: 900;"></i>
          <span class="text-primary cursor-pointer hover-underline" id="breadcrumb-lp-link" style="font-weight: 600; cursor: pointer; text-decoration: none;">Landing Page</span>
          <i class="bi bi-chevron-double-right text-muted mx-1" style="font-size: 10px; -webkit-text-stroke: 0.75px #64748b; font-weight: 900;"></i>
          <span class="text-secondary fw-bold" style="font-weight: bold;">Create Landing Page</span>
        </div>
      `;

      const setupLink = document.getElementById("breadcrumb-setup-link");
      const lpLink = document.getElementById("breadcrumb-lp-link");
      
      const goBack = (e) => {
        e.preventDefault();
        onCancel();
      };

      if (setupLink) setupLink.addEventListener("click", goBack);
      if (lpLink) lpLink.addEventListener("click", goBack);

      return () => {
        topbarTitleEl.innerHTML = originalHTML;
      };
    }
  }, [onCancel]);

  const handleResizeMouseDown = (e, compId, direction) => {
    e.stopPropagation();
    e.preventDefault();
    const comp = page.components.find((c) => c.id === compId);
    if (!comp) return;

    const widthVal = comp.styles?.width || "100%";
    const width = widthVal.includes("%") ? parseInt(widthVal) || 100 : Math.round((parseInt(widthVal) || 800) / 8);
    const height = comp.styles?.height === "auto" ? 0 : (parseInt(comp.styles?.height) || 300);
    const paddingTop = parseInt(comp.styles?.paddingTop) || 0;
    const paddingBottom = parseInt(comp.styles?.paddingBottom) || 0;

    setResizing({
      compId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: width,
      startHeight: height,
      startPaddingTop: paddingTop,
      startPaddingBottom: paddingBottom
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;

      const comp = latestPageRef.current.components.find((c) => c.id === resizing.compId);
      if (!comp) return;

      const nextStyles = { ...(comp.styles || {}) };

      if (resizing.direction.includes("e")) {
        const newWidth = Math.max(20, Math.min(100, resizing.startWidth + Math.round(dx / 8)));
        nextStyles.width = `${newWidth}%`;
      }

      if (resizing.direction.includes("s")) {
        if (comp.styles?.height && comp.styles?.height !== "auto") {
          const newHeight = Math.max(50, resizing.startHeight + dy);
          nextStyles.height = `${newHeight}px`;
        } else {
          const newPaddingBottom = Math.max(0, resizing.startPaddingBottom + dy);
          nextStyles.paddingBottom = `${newPaddingBottom}px`;
        }
      }

      setPage((prev) => {
        const nextComps = prev.components.map((c) => {
          if (c.id === resizing.compId) {
            return { ...c, styles: nextStyles };
          }
          return c;
        });
        return { ...prev, components: nextComps };
      });
    };

    const handleMouseUp = () => {
      pushState(latestPageRef.current);
      setResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Inline Canvas Editors helpers
  const renderEditableText = (comp, field, tag = "span", className = "", style = {}) => {
    const text = comp.content?.[field] || "";
    
    const handleBlur = (e) => {
      const newVal = e.target.textContent || "";
      const nextComps = page.components.map((c) => {
        if (c.id === comp.id) {
          return { ...c, content: { ...c.content, [field]: newVal } };
        }
        return c;
      });
      pushState({ ...page, components: nextComps });
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.target.blur();
      }
    };

    const TagName = tag;

    return (
      <TagName
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`builder-editable-text ${className}`}
        style={{ 
          outline: "none",
          cursor: "text",
          minWidth: "15px",
          display: "inline-block",
          borderBottom: "1px dashed rgba(34, 73, 183, 0.25)",
          padding: "1px 2px",
          ...style 
        }}
        title="Click to edit text inline"
      >
        {text}
      </TagName>
    );
  };

  const renderEditableLink = (comp, index, className = "", style = {}) => {
    const link = comp.content?.menuLinks?.[index];
    if (!link) return null;
    
    const handleBlur = (e) => {
      const newVal = e.target.textContent || "";
      const updatedLinks = [...(comp.content.menuLinks || [])];
      updatedLinks[index] = { ...updatedLinks[index], label: newVal };

      const nextComps = page.components.map((c) => {
        if (c.id === comp.id) {
          return { ...c, content: { ...c.content, menuLinks: updatedLinks } };
        }
        return c;
      });
      pushState({ ...page, components: nextComps });
    };

    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`builder-editable-text ${className}`}
        style={{ 
          outline: "none",
          cursor: "text",
          borderBottom: "1px dashed rgba(34, 73, 183, 0.2)",
          padding: "0 1px",
          ...style 
        }}
      >
        {link.label}
      </span>
    );
  };

  const renderEditableImage = (comp, field, className = "", style = {}) => {
    const imgUrl = comp.content?.[field] || "";
    return (
      <EditableImageWrapper 
        comp={comp} 
        field={field} 
        imgUrl={imgUrl} 
        className={className} 
        style={style} 
        pushState={pushState} 
        page={page} 
      />
    );
  };

  const getStyleName = (type, styleId) => {
    if (type === "header-nav") {
      switch (styleId) {
        case "type1": return "Style 1: Professional Centered";
        case "type2": return "Style 2: Centered Links Right CTA";
        case "type3": return "Style 3: Minimal Centered Stacked Logo";
        case "type4": return "Style 4: Double Decker Top Utility Bar";
        case "type5": return "Style 5: Floating Glassmorphic Header";
        case "type6": return "Style 6: Glassmorphic Overlay Floating";
        case "type7": return "Style 7: Neumorphic Soft Inset Card";
        case "type8": return "Style 8: Left Heavy Bold Sidebar-Style";
        case "type9": return "Style 9: Indigo/Purple Gradient Banner";
        case "type10": return "Style 10: Clean Transparent Borderless Grid";
        case "type11": return "Style 11: Dark Slate Warning Accent";
        default: return `Style ${styleId.replace("type", "")}`;
      }
    } else if (type && type.includes("hero")) {
      switch (styleId) {
        case "type1": return "Style 1: Left Text Right Form Solid Box";
        case "type2": return "Style 2: Parallax Photo Background Blur Form";
        case "type3": return "Style 3: Flipped Column Layout Form Left";
        case "type4": return "Style 4: Left Text Right Video Embed Split";
        case "type5": return "Style 5: Full Width Centered Indigo Gradient";
        case "type6": return "Style 6: Glassmorphic Centered Overlay Hero";
        case "type7": return "Style 7: Neumorphic Soft Bordered Hero";
        case "type8": return "Style 8: Left Heavy Accent Sidebar Style";
        case "type9": return "Style 9: Cyan Gradient Banner Centered";
        case "type10": return "Style 10: Clean Minimalist Borderless Grid";
        case "type11": return "Style 11: High-Contrast Dark Slate Accent";
        default: return `Style ${styleId.replace("type", "")}`;
      }
    }
    switch (styleId) {
      case "type1": return "Style 1: Default Professional";
      case "type2": return "Style 2: Centered Layout";
      case "type3": return "Style 3: Minimal Compact / Flipped";
      case "type4": return "Style 4: Double Decker / Media Video";
      case "type5": return "Style 5: Premium Dark Accent / Floating";
      case "type6": return "Style 6: Glassmorphic Overlay";
      case "type7": return "Style 7: Neumorphic Soft Bordered";
      case "type8": return "Style 8: Left Heavy Bold Sidebar-Style";
      case "type9": return "Style 9: Gradient Highlight Banner";
      case "type10": return "Style 10: Clean Borderless Grid";
      case "type11": return "Style 11: High-Contrast Dark Accent";
      default: return `Style ${styleId.replace("type", "")}`;
    }
  };

  const handleMouseEnterCard = (item) => {
    if (activeCategory !== "presets") return;
    if (presetTimeoutRef.current) clearTimeout(presetTimeoutRef.current);
    setHoveredPresetItem(item);
  };

  const handleMouseLeaveCard = () => {
    presetTimeoutRef.current = setTimeout(() => {
      setHoveredPresetItem(null);
    }, 250);
  };

  const handleMouseEnterDrawer = () => {
    if (presetTimeoutRef.current) clearTimeout(presetTimeoutRef.current);
  };

  const handleMouseLeaveDrawer = () => {
    setHoveredPresetItem(null);
  };

  useEffect(() => {
    async function loadForms() {
      try {
        setLoadingForms(true);
        const res = await workflowConfigApi.get("enquiryForms");
        const list = res?.data?.forms || res?.forms || [];
        setEnquiryFormsList(list.filter((f) => f.isActive !== false));
      } catch (e) {
        console.error("Failed to load enquiry forms", e);
      } finally {
        setLoadingForms(false);
      }
    }
    loadForms();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCompId) return;

      // Skip deletion if user is typing inside input/textarea fields
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isTyping) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        const compToDelete = page.components.find((c) => c.id === selectedCompId);
        if (compToDelete && compToDelete.type === "custom-html") {
          e.preventDefault();
          setConfirmDialog({
            title: "Delete Custom HTML Block",
            message: "Are you sure you want to delete this custom HTML block and all its contents?",
            onConfirm: () => {
              pushState({
                ...page,
                components: page.components.filter((c) => c.id !== selectedCompId)
              });
              setSelectedCompId(null);
              toast.show("Component removed", "success");
            }
          });
          return;
        }
        e.preventDefault();
        pushState({
          ...page,
          components: page.components.filter((c) => c.id !== selectedCompId)
        });
        setSelectedCompId(null);
        toast.show("Component removed", "success");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCompId, page.components, page]);

  const pushState = (nextPage) => {
    setHistory((prev) => [...prev.slice(-30), page]);
    setRedoStack([]);
    setPage(nextPage);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [page, ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    setPage(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prev) => [...prev, page]);
    setRedoStack((prev) => prev.slice(1));
    setPage(next);
  };

  const updatePageTitle = (val) => {
    pushState({ ...page, name: val });
  };

  const updatePageType = (val) => {
    pushState({ ...page, pageType: val });
  };

  const updateCanvasWidth = (val) => {
    pushState({ ...page, canvasWidth: val });
  };

  const updateCanvasHeight = (val) => {
    pushState({ ...page, canvasHeight: val });
  };

  const addComponent = (typeObj, customContent = null) => {
    const newComp = {
      id: `comp-${typeObj.type}-${Date.now()}`,
      type: typeObj.type,
      content: customContent ? JSON.parse(JSON.stringify(customContent)) : JSON.parse(JSON.stringify(typeObj.defaultContent)),
      styles: {
        ...JSON.parse(JSON.stringify(typeObj.defaultStyles || {})),
        position: "absolute",
        left: "50px",
        top: `${page.components.length * 180 + 50}px`,
        zIndex: 10
      },
      animation: {
        type: "none",
        duration: "0.5s",
        delay: "0s"
      }
    };
    pushState({
      ...page,
      components: [...page.components, newComp]
    });
    setSelectedCompId(newComp.id);
    toast(`Added ${typeObj.name}`);
  };

  const insertComponentAt = (index, typeObj) => {
    const newComp = {
      id: `comp-${typeObj.type}-${Date.now()}`,
      type: typeObj.type,
      content: JSON.parse(JSON.stringify(typeObj.defaultContent)),
      styles: {
        ...JSON.parse(JSON.stringify(typeObj.defaultStyles || {})),
        position: "absolute",
        left: "50px",
        top: `${index * 180 + 50}px`,
        zIndex: 10
      },
      animation: {
        type: "none",
        duration: "0.5s",
        delay: "0s"
      }
    };
    const nextComps = [...page.components];
    nextComps.splice(index, 0, newComp);
    pushState({
      ...page,
      components: nextComps
    });
    setSelectedCompId(newComp.id);
    setShowQuickAddMenu(null);
    toast(`Inserted ${typeObj.name}`);
  };

  const alignElement = (alignmentType) => {
    if (!selectedCompId) return;
    const comp = page.components.find((c) => c.id === selectedCompId);
    if (!comp) return;

    const element = document.getElementById(selectedCompId);
    let wVal = 300;
    let hVal = 150;
    if (element) {
      const rect = element.getBoundingClientRect();
      wVal = Math.round(rect.width);
      hVal = Math.round(rect.height);
    } else {
      // Fallback
      const widthStr = comp.styles?.width || "100%";
      const heightStr = comp.styles?.height || "auto";
      wVal = widthStr.includes("%") ? 400 : (parseInt(widthStr) || 300);
      hVal = heightStr === "auto" ? 150 : (parseInt(heightStr) || 150);
    }

    const updatedStyles = { ...comp.styles };
    const halfW = Math.round(wVal / 2);
    const halfH = Math.round(hVal / 2);

    if (alignmentType === "left") {
      updatedStyles.left = "10px";
    } else if (alignmentType === "center-x") {
      updatedStyles.left = `calc(50% - ${halfW}px)`;
    } else if (alignmentType === "right") {
      updatedStyles.left = `calc(100% - ${wVal + 10}px)`;
    } else if (alignmentType === "top") {
      updatedStyles.top = "10px";
    } else if (alignmentType === "center-y") {
      updatedStyles.top = `calc(50% - ${halfH}px)`;
    } else if (alignmentType === "bottom") {
      updatedStyles.top = `calc(100% - ${hVal + 10}px)`;
    } else if (alignmentType === "center-page") {
      updatedStyles.left = `calc(50% - ${halfW}px)`;
      updatedStyles.top = `calc(50% - ${halfH}px)`;
    } else if (alignmentType === "top-center") {
      updatedStyles.left = `calc(50% - ${halfW}px)`;
      updatedStyles.top = "10px";
    } else if (alignmentType === "left-center") {
      updatedStyles.left = "10px";
      updatedStyles.top = `calc(50% - ${halfH}px)`;
    } else if (alignmentType === "right-center") {
      updatedStyles.left = `calc(100% - ${wVal + 10}px)`;
      updatedStyles.top = `calc(50% - ${halfH}px)`;
    } else if (alignmentType === "left-top") {
      updatedStyles.left = "10px";
      updatedStyles.top = "10px";
    } else if (alignmentType === "right-top") {
      updatedStyles.left = `calc(100% - ${wVal + 10}px)`;
      updatedStyles.top = "10px";
    } else if (alignmentType === "left-bottom") {
      updatedStyles.left = "10px";
      updatedStyles.top = `calc(100% - ${hVal + 10}px)`;
    } else if (alignmentType === "right-bottom") {
      updatedStyles.left = `calc(100% - ${wVal + 10}px)`;
      updatedStyles.top = `calc(100% - ${hVal + 10}px)`;
    } else if (alignmentType === "bottom-center") {
      updatedStyles.left = `calc(50% - ${halfW}px)`;
      updatedStyles.top = `calc(100% - ${hVal + 10}px)`;
    }

    const nextComps = page.components.map((c) => {
      if (c.id === selectedCompId) {
        return { ...c, styles: updatedStyles };
      }
      return c;
    });
    pushState({ ...page, components: nextComps });
  };

  const handleDropItem = (targetIndex, droppedType, droppedDragIdxStr, x = null, y = null) => {
    const nextComps = [...page.components];

    if (droppedDragIdxStr) {
      const sourceIdx = parseInt(droppedDragIdxStr, 10);
      if (Number.isNaN(sourceIdx)) return;
      const [moved] = nextComps.splice(sourceIdx, 1);
      const insertAt = sourceIdx < targetIndex ? targetIndex - 1 : targetIndex;
      nextComps.splice(insertAt, 0, moved);
      pushState({ ...page, components: nextComps });
      toast("Reordered element");
    } else if (droppedType) {
      const template = COMPONENT_TYPES.find((ct) => ct.type === droppedType);
      if (!template) return;
      const newComp = {
        id: `comp-${template.type}-${Date.now()}`,
        type: template.type,
        content: JSON.parse(JSON.stringify(template.defaultContent)),
        styles: {
          ...JSON.parse(JSON.stringify(template.defaultStyles || {})),
          position: "absolute",
          left: x !== null ? `${x}px` : "50px",
          top: y !== null ? `${y}px` : `${targetIndex * 180 + 50}px`,
          zIndex: 10
        },
        animation: {
          type: "none",
          duration: "0.5s",
          delay: "0s"
        }
      };
      nextComps.splice(targetIndex, 0, newComp);
      pushState({ ...page, components: nextComps });
      setSelectedCompId(newComp.id);
      toast(`Created and placed ${template.name}`);
    }
  };

  const cloneComponent = (compId, e) => {
    e.stopPropagation();
    const idx = page.components.findIndex((c) => c.id === compId);
    if (idx === -1) return;
    const target = page.components[idx];
    const copy = {
      ...target,
      id: `comp-${target.type}-${Date.now()}`,
      content: JSON.parse(JSON.stringify(target.content)),
      styles: JSON.parse(JSON.stringify(target.styles || {})),
      animation: JSON.parse(JSON.stringify(target.animation || { type: "none", duration: "0.5s", delay: "0s" }))
    };
    const nextComps = [...page.components];
    nextComps.splice(idx + 1, 0, copy);
    pushState({ ...page, components: nextComps });
    setSelectedCompId(copy.id);
    toast("Duplicated element");
  };

  const removeComponent = (compId, e) => {
    e.stopPropagation();
    if (selectedCompId === compId) setSelectedCompId(null);
    const filtered = page.components.filter((c) => c.id !== compId);
    pushState({ ...page, components: filtered });
    toast("Element removed");
  };

  const moveComponent = (index, dir, e) => {
    e.stopPropagation();
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= page.components.length) return;
    const nextComps = [...page.components];
    const temp = nextComps[index];
    nextComps[index] = nextComps[nextIdx];
    nextComps[nextIdx] = temp;
    pushState({ ...page, components: nextComps });
  };

  const updateSelectedContent = (field, val) => {
    const nextComps = page.components.map((c) => {
      if (c.id === selectedCompId) {
        return { ...c, content: { ...c.content, [field]: val } };
      }
      return c;
    });
    pushState({ ...page, components: nextComps });
  };

  const updateSelectedStyle = (field, val) => {
    const nextComps = page.components.map((c) => {
      if (c.id === selectedCompId) {
        return { ...c, styles: { ...c.styles, [field]: val } };
      }
      return c;
    });
    pushState({ ...page, components: nextComps });
  };

  const handleAbsoluteDragStart = (e, compId) => {
    e.preventDefault();
    e.stopPropagation();

    const blockEl = e.currentTarget.closest(".hover-builder-block");
    if (!blockEl) return;
    
    const parentEl = blockEl.offsetParent || blockEl.parentNode;
    if (!parentEl) return;

    const rect = blockEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();

    const startLeft = rect.left - parentRect.left;
    const startTop = rect.top - parentRect.top;

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;

      const nextComps = page.components.map((c) => {
        if (c.id === compId) {
          return {
            ...c,
            styles: {
              ...c.styles,
              left: `${newLeft}px`,
              top: `${newTop}px`
            }
          };
        }
        return c;
      });
      pushState({ ...page, components: nextComps });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const updateSelectedAnimation = (field, val) => {
    const nextComps = page.components.map((c) => {
      if (c.id === selectedCompId) {
        const anim = c.animation || { type: "none", duration: "0.5s", delay: "0s" };
        return { ...c, animation: { ...anim, [field]: val } };
      }
      return c;
    });
    pushState({ ...page, components: nextComps });
  };

  const selectedComp = page.components.find((c) => c.id === selectedCompId);

  const save = () => {
    if (!page.name || !page.name.trim()) {
      toast("Landing page name is required", "error");
      return;
    }
    const hero = page.components.find((c) => c.type === "hero-split" || c.type === "hero");
    const header = page.components.find((c) => c.type === "header-nav");
    const payload = {
      ...page,
      name: page.name.trim(),
      brandName: page.brandName || header?.content?.brandName || hero?.content?.brandName || "",
      heroTitle: hero?.content?.title || page.name,
      heroSubtitle: hero?.content?.subtitle || "",
      heroCtaLabel: hero?.content?.ctaText || "Submit Inquiry",
      heroCtaLink: hero?.content?.ctaLink || "#contact-form",
      accentColor: page.theme?.primaryColor || "#2249b7",
      features: page.components.find((c) => c.type === "feature-showcase")?.content?.items?.map((item) => item.heading) || []
    };
    onSave(payload);
  };

  const openJsonModal = () => {
    setJsonInput(JSON.stringify(page, null, 2));
    setShowJsonModal(true);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.components || !Array.isArray(parsed.components)) {
        throw new Error("Invalid schema: 'components' array is missing");
      }
      pushState(parsed);
      setShowJsonModal(false);
      toast("Schema imported!");
    } catch (e) {
      alert(`Invalid JSON:\n${e.message}`);
    }
  };
  const handleAddCustomHtml = () => {
    if (!customHtmlCode || !customHtmlCode.trim()) {
      toast("Please enter some HTML code", "error");
      return;
    }
    
    // Check if we already have a custom HTML component to edit
    const existingComp = page.components.find((c) => c.type === "custom-html");
    if (existingComp) {
      const nextComps = page.components.map((c) => {
        if (c.type === "custom-html") {
          return {
            ...c,
            content: {
              ...c.content,
              htmlCode: customHtmlCode
            }
          };
        }
        return c;
      });
      pushState({ ...page, components: nextComps });
      setShowHtmlModal(false);
      setCustomHtmlCode("");
      toast("Custom HTML code updated successfully");
      return;
    }
    
    const executeAdd = () => {
      const newComp = {
        id: `comp-html-${Date.now()}`,
        type: "custom-html",
        content: {
          htmlCode: customHtmlCode
        },
        styles: {
          width: "100%",
          height: "auto",
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          paddingRight: "0px"
        }
      };
      pushState({ ...page, components: [newComp] });
      setShowHtmlModal(false);
      setCustomHtmlCode("");
      toast("Canvas design replaced with custom HTML");
    };

    if (page.components.length > 0) {
      setConfirmDialog({
        title: "Replace Design",
        message: "Adding custom HTML will completely replace all existing visual elements in your design. Do you want to proceed?",
        onConfirm: executeAdd
      });
    } else {
      executeAdd();
    }
  };

  const handleSwitchToSource = () => {
    if (!page.rawHtml) {
      const initialHtml = compileComponentsToHtml(page.components, page.theme);
      setHtmlSourceCode(initialHtml);
      pushState({ ...page, rawHtml: initialHtml });
    } else {
      setHtmlSourceCode(page.rawHtml);
    }
    setEditorMode("source");
  };

  const handleSourceChange = (e) => {
    const newHtml = e.target.value;
    setHtmlSourceCode(newHtml);
    setPage((prev) => ({ ...prev, rawHtml: newHtml }));
  };

  const handleResetToVisual = () => {
    setConfirmDialog({
      title: "Discard HTML Changes",
      message: "Are you sure you want to discard your custom HTML source changes and restore the visual components?",
      onConfirm: () => {
        setPage((prev) => {
          const next = { ...prev };
          delete next.rawHtml;
          return next;
        });
        setEditorMode("visual");
      }
    });
  };
  // DropZoneLine helper
  function DropZoneLine({ index }) {
    const [isHovered, setIsHovered] = useState(false);

    const isTargetZoneActive = activeDragOverIndex === index;

    const height = (isHovered || isTargetZoneActive) ? "50px" : (isDraggingActive ? "35px" : "12px");
    const border = (isHovered || isTargetZoneActive) 
      ? "2px dashed #2249b7" 
      : (isDraggingActive ? "1.5px dashed #cbd5e1" : "none");
    const background = (isHovered || isTargetZoneActive) 
      ? "rgba(34, 73, 183, 0.15)" 
      : (isDraggingActive ? "rgba(241, 245, 249, 0.6)" : "transparent");

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsHovered(true);
        }}
        onDragLeave={() => setIsHovered(false)}
        onDrop={(e) => {
          setIsHovered(false);
          setIsDraggingActive(false);
          setActiveDragOverIndex(null);
          const type = e.dataTransfer.getData("element-type");
          const dragIdxStr = e.dataTransfer.getData("drag-index");
          handleDropItem(index, type, dragIdxStr);
        }}
        className="builder-dropzone-marker d-flex align-items-center justify-content-center"
        style={{
          height: height,
          background: background,
          border: border,
          borderRadius: "8px",
          margin: "4px 0",
          cursor: "pointer",
          position: "relative",
          zIndex: 10,
          transition: "all 0.15s ease-in-out"
        }}
      >
        {isHovered ? (
          <span className="text-wa small fw-bold" style={{ fontSize: "11px" }}>
            <i className="bi bi-box-arrow-in-down me-1"></i> DROP HERE
          </span>
        ) : (isDraggingActive ? (
          <span className="text-muted" style={{ fontSize: "10px", opacity: 0.6 }}>Insert block here</span>
        ) : (
          <button
            type="button"
            className="btn btn-xs rounded-circle bg-white text-wa shadow-sm hover-scale dropzone-add-btn"
            style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #cbd5e1" }}
            onClick={() => setShowQuickAddMenu(index)}
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100 bg-white" style={{ minHeight: "85vh", borderRadius: "14px", overflow: "hidden" }}>
      {/* Top Toolbar Header */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-xs btn-outline-secondary d-flex align-items-center py-0.5 px-2" onClick={(e) => {
              if (history.length > 0) {
                setConfirmDialog({
                  title: "Unsaved Changes",
                  message: "You have unsaved changes. Are you sure you want to go back?",
                  onConfirm: onCancel
                });
              } else {
                onCancel();
              }
            }} style={{ borderRadius: "6px", fontSize: "10px", height: "22px" }}>
              <i className="bi bi-chevron-left me-1"></i>Back
            </button>
            <i className="bi bi-grid-1x2-fill text-wa" style={{ fontSize: "14px" }}></i>
            <input
              type="text"
              className="form-control form-control-sm fw-bold py-0"
              value={page.name}
              onChange={(e) => updatePageTitle(e.target.value)}
              style={{ width: "180px", border: "1px solid #cbd5e1", borderRadius: "6px", height: "22px", fontSize: "11px" }}
              placeholder="Landing Page Name"
            />
          </div>
        </div>

        {/* Viewport frames & Canvas Size toolbar */}
        <div className="d-flex align-items-center gap-3">
          {/* Viewport toggle */}
          <div className="d-flex align-items-center gap-1 bg-white p-1 rounded-3 border">
            <button
              type="button"
              className={`btn btn-sm px-3 py-1 ${viewportMode === "desktop" ? "bg-accent-soft text-wa font-semibold" : "text-muted"}`}
              onClick={() => setViewportMode("desktop")}
              title="Desktop view"
              style={{ borderRadius: "6px", border: "none" }}
            >
              <i className="bi bi-display"></i>
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 py-1 ${viewportMode === "tablet" ? "bg-accent-soft text-wa font-semibold" : "text-muted"}`}
              onClick={() => setViewportMode("tablet")}
              title="Tablet view"
              style={{ borderRadius: "6px", border: "none" }}
            >
              <i className="bi bi-tablet-landscape"></i>
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 py-1 ${viewportMode === "mobile" ? "bg-accent-soft text-wa font-semibold" : "text-muted"}`}
              onClick={() => setViewportMode("mobile")}
              title="Mobile view"
              style={{ borderRadius: "6px", border: "none" }}
            >
              <i className="bi bi-phone"></i>
            </button>
          </div>

          {/* Quick Canvas Size Controls */}
          <div className="d-flex align-items-center gap-2 bg-white px-2 py-1 rounded-3 border small">
            <span className="text-muted fw-bold" style={{ fontSize: "9px", letterSpacing: "0.3px" }}>CANVAS SIZE</span>
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted" style={{ fontSize: "10px" }}>W:</span>
              <input
                type="text"
                className="form-control form-control-xs text-center py-0"
                style={{ width: "55px", height: "20px", fontSize: "10px", padding: "1px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                value={page.canvasWidth || "100%"}
                onChange={(e) => updateCanvasWidth(e.target.value)}
                placeholder="100%"
              />
            </div>
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted" style={{ fontSize: "10px" }}>H:</span>
              <input
                type="text"
                className="form-control form-control-xs text-center py-0"
                style={{ width: "55px", height: "20px", fontSize: "10px", padding: "1px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                value={page.canvasHeight || "750px"}
                onChange={(e) => updateCanvasHeight(e.target.value)}
                placeholder="750px"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary px-2" disabled={history.length === 0} onClick={handleUndo} title="Undo">
            <i className="bi bi-arrow-counterclockwise"></i>
          </button>
          <button className="btn btn-sm btn-outline-secondary px-2" disabled={redoStack.length === 0} onClick={handleRedo} title="Redo">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
          <button className="btn btn-sm btn-outline-info" onClick={() => {
            const customHtmlComp = page.components.find((c) => c.type === "custom-html");
            setCustomHtmlCode(customHtmlComp?.content?.htmlCode || "");
            setShowHtmlModal(true);
          }}>
            <i className="bi bi-file-earmark-code me-1"></i>
            {page.components.some((c) => c.type === "custom-html") ? "Edit HTML" : "Add HTML"}
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowPreview(true)}>
            <i className="bi bi-eye me-1"></i>Preview
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={openJsonModal}>
            <i className="bi bi-code-slash me-1"></i>JSON
          </button>
          <button className="btn btn-sm btn-wa" onClick={save}>
            <i className="bi bi-cloud-arrow-up me-1"></i>Save Page
          </button>
        </div>
      </div>

      {/* Main Builder layout columns */}
      <div className="row g-0 flex-grow-1" style={{ minHeight: "75vh" }}>
        {/* Left Toolbox Panel Wrapper */}
        <div style={{ width: "16%", flexShrink: 0, position: "relative" }} className="border-end bg-light d-flex flex-column" onMouseLeave={handleMouseLeaveCard}>
          {/* Scrollable Toolbox Content */}
          <div style={{ maxHeight: "calc(100vh - 130px)", overflowY: "auto" }} className="p-2 flex-grow-1 hide-scrollbar">
            <div className="d-flex flex-column gap-3 text-start">
              <span className="text-secondary small fw-bold text-uppercase" style={{ letterSpacing: "0.5px", fontSize: "10px" }}>Drag Elements onto Canvas</span>

              {/* Category selection tabs */}
              <div className="d-flex flex-wrap gap-1 mb-2 border-bottom pb-2">
                {[
                  { id: "presets", label: "Sections" },
                  { id: "basic", label: "Basic" },
                  { id: "form", label: "Form" },
                  { id: "layout", label: "Layout" },
                  { id: "media", label: "Media" },
                  { id: "interactive", label: "Interactive" },
                  { id: "advanced", label: "Advanced" }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`btn btn-xs py-1 px-2 ${activeCategory === cat.id ? "btn-wa text-white font-semibold" : "btn-outline-secondary"}`}
                    style={{ fontSize: "10px", borderRadius: "4px" }}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Elements list based on category */}
              <div className="w-100">
                <div style={{
                  display: "grid",
                  gridTemplateColumns: activeCategory === "presets" ? "1fr" : "1fr 1fr",
                  gap: "6px",
                  padding: "4px 0"
                }}>
                  {COMPONENT_TYPES.filter((c) => c.category === activeCategory).map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("element-type", item.type);
                        e.dataTransfer.effectAllowed = "move";
                        setIsDraggingActive(true);
                      }}
                      onDragEnd={() => setIsDraggingActive(false)}
                      onMouseEnter={() => handleMouseEnterCard(item)}
                      onMouseLeave={handleMouseLeaveCard}
                      className={`card border-dashed ${
                        hoveredPresetItem?.type === item.type 
                          ? "border-primary bg-light shadow-sm" 
                          : ""
                      } ${activeCategory === "presets" ? "p-2 d-flex flex-row align-items-center justify-content-start px-3 text-start" : "p-1 text-center align-items-center justify-content-center d-flex flex-column"}`}
                      style={{ 
                        cursor: "grab", 
                        minHeight: activeCategory === "presets" ? "auto" : "75px", 
                        borderRadius: "8px", 
                        margin: "0", 
                        overflow: "hidden", 
                        width: "100%", 
                        gap: activeCategory === "presets" ? "12px" : "0px",
                        borderColor: hoveredPresetItem?.type === item.type ? "#2249b7" : undefined,
                        backgroundColor: hoveredPresetItem?.type === item.type ? "#eff6ff" : undefined,
                        boxShadow: hoveredPresetItem?.type === item.type ? "0 4px 6px -1px rgba(37, 99, 235, 0.1), 0 2px 4px -1px rgba(37, 99, 235, 0.06)" : undefined,
                        transform: hoveredPresetItem?.type === item.type ? "scale(1.02)" : undefined,
                        transition: "all 0.2s ease-in-out"
                      }}
                      onClick={() => activeCategory !== "presets" && addComponent(item)}
                    >
                      <i className={`bi ${item.icon} fs-5 text-wa`}></i>
                      <div className={activeCategory === "presets" ? "text-start flex-grow-1" : "text-center w-100 px-1"}>
                        <span className="fw-semibold d-block text-truncate-custom" style={{ fontSize: "9.5px", lineHeight: "1.15", wordBreak: "break-word", whiteSpace: "normal" }}>{item.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Slider Drawer for Preset Styles (next to left panel wrapper) */}
          <div
            className="hide-scrollbar"
            style={{
              position: "absolute",
              left: "100%",
              top: "0",
              bottom: "0",
              width: "280px",
              zIndex: 1050,
              backgroundColor: "#f8fafc",
              boxShadow: "5px 0 15px rgba(0,0,0,0.06)",
              borderRight: "1px solid #cbd5e1",
              borderLeft: "1px solid #cbd5e1",
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              textAlign: "left",
              // Smooth 0.3s slide-in/out transition
              transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out, visibility 0.3s ease-in-out",
              transform: hoveredPresetItem ? "translateX(0)" : "translateX(-15px)",
              opacity: hoveredPresetItem ? 1 : 0,
              visibility: hoveredPresetItem ? "visible" : "hidden"
            }}
            onMouseEnter={handleMouseEnterDrawer}
            onMouseLeave={handleMouseLeaveDrawer}
          >
            {hoveredPresetItem && (
              <>
                <div className="pb-2 border-bottom">
                  <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "9px", letterSpacing: "0.5px" }}>CHOOSE PRESET STYLE</span>
                  <h6 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: "13px" }}>{hoveredPresetItem.name}</h6>
                </div>
                
                <div className="d-flex flex-column" style={{ gap: "14px" }}>
                  {[
                    { id: "type1", name: "Style 1: Professional" },
                    { id: "type2", name: "Style 2: Centered Layout" },
                    { id: "type3", name: "Style 3: Minimal Flipped" },
                    { id: "type4", name: "Style 4: Media Highlight" },
                    { id: "type5", name: "Style 5: Premium Dark Accent" },
                    { id: "type6", name: "Style 6: Glassmorphic Overlay" },
                    { id: "type7", name: "Style 7: Neumorphic Soft" },
                    { id: "type8", name: "Style 8: Left Heavy Accent" },
                    { id: "type9", name: "Style 9: Gradient Highlight" },
                    { id: "type10", name: "Style 10: Clean Borderless" },
                    { id: "type11", name: "Style 11: Dark High-Contrast" }
                  ].map((style) => (
                    <div
                      key={style.id}
                      className="card p-2.5 border border-light shadow-xs"
                      style={{
                        borderRadius: "8px",
                        background: "#ffffff"
                      }}
                    >
                      <div className="d-flex flex-column gap-2">
                        {/* Wireframe Mockup UI of Hovered Preset Style */}
                        {renderStyleMockup(hoveredPresetItem.type, style.id)}

                        <div className="text-center">
                          <span className="fw-semibold text-dark d-block" style={{ fontSize: "10px" }}>{getStyleName(hoveredPresetItem.type, style.id).split(":")[0]}</span>
                          <div className="text-muted mb-1" style={{ fontSize: "8px", marginTop: "2px", lineHeight: "1.1" }}>{getStyleName(hoveredPresetItem.type, style.id).split(":")[1]?.trim()}</div>
                          <button
                            className="btn btn-sm btn-primary w-100 fw-medium shadow-xs"
                            style={{ fontSize: "10px", padding: "3px 6px" }}
                            onClick={() => {
                              const customContent = {
                                ...(hoveredPresetItem.defaultContent || {}),
                                presetType: style.id
                              };
                              addComponent(hoveredPresetItem, customContent);
                              setHoveredPresetItem(null);
                            }}
                          >
                            Apply Style
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center Frame Dropzone */}
        <div style={{ width: "66%", maxHeight: "calc(100vh - 130px)", overflowY: "auto", background: "#f1f5f9" }} className="bg-slate-light p-4 d-flex justify-content-center align-items-start hide-scrollbar">
          {/* Canvas frame container */}
          <div
            ref={canvasRef}
            className="shadow-lg border bg-white"
            onDragLeave={handleDragLeaveCanvas}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              const type = e.dataTransfer.getData("element-type");
              if (!type) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.round(e.clientX - rect.left);
              const y = Math.round(e.clientY - rect.top);
              handleDropItem(page.components.length, type, null, x, y);
            }}
            style={{
               width: viewportMode === "mobile" ? "420px" : viewportMode === "tablet" ? "768px" : page.canvasWidth || "100%",
               minHeight: page.canvasHeight || "750px",
               borderRadius: viewportMode === "mobile" ? "36px" : viewportMode === "tablet" ? "16px" : "0px",
               borderWidth: viewportMode === "mobile" ? "12px" : "1px",
               borderColor: viewportMode === "mobile" ? "#1e293b" : "#cbd5e1",
               transition: "all 0.3s ease-in-out",
               position: "relative",
               backgroundImage: "radial-gradient(#e2e8f0 1.5px, transparent 1.5px)",
               backgroundSize: "20px 20px"
            }}
          >
            {/* Top Drop Zone Line */}
            <DropZoneLine index={0} />

            {/* Canvas components rendering */}
            {page.components.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const type = e.dataTransfer.getData("element-type");
                  handleDropItem(0, type, null);
                }}
                className="text-center py-5 text-muted px-4 mt-5 border border-dashed m-3"
                style={{ borderRadius: "12px", minHeight: "350px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
              >
                <i className="bi bi-box-arrow-in-down fs-1 mb-2 text-wa" style={{ opacity: 0.5 }}></i>
                <h5>Empty Visual Workspace</h5>
                <p className="small">Drag element cards from the left panel and drop them inside this area, or click them to append!</p>
              </div>
            ) : (
              <div className="d-flex flex-column text-start" style={{ fontFamily: page.theme.fontFamily || "system-ui" }}>
                {page.components.map((comp, idx) => (
                  <div key={comp.id}>
                    <VisualBlock
                      comp={comp}
                      idx={idx}
                      isSelected={selectedCompId === comp.id}
                      canvasRef={canvasRef}
                      onSelect={() => {
                        setSelectedCompId(comp.id);
                        setRightTab("Content");
                      }}
                      onMoveCommit={(pos) => {
                        const nextComps = page.components.map((c) => {
                          if (c.id === comp.id) {
                            return { ...c, styles: { ...c.styles, left: `${pos.x}px`, top: `${pos.y}px` } };
                          }
                          return c;
                        });
                        pushState({ ...page, components: nextComps });
                      }}
                      onResizeCommit={(size) => {
                        const nextComps = page.components.map((c) => {
                          if (c.id === comp.id) {
                            return { ...c, styles: { ...c.styles, width: size.width, height: size.height } };
                          }
                          return c;
                        });
                        pushState({ ...page, components: nextComps });
                      }}
                      cloneComponent={cloneComponent}
                      removeComponent={removeComponent}
                      moveComponent={moveComponent}
                      page={page}
                      formsList={formsList}
                      previewFormValues={previewFormValues}
                      setPreviewFormValues={setPreviewFormValues}
                      renderEditableText={renderEditableText}
                      renderEditableImage={renderEditableImage}
                      renderEditableLink={renderEditableLink}
                      COMPONENT_TYPES={COMPONENT_TYPES}
                      pushState={pushState}
                      setIsDraggingActive={setIsDraggingActive}
                      setActiveDragOverIndex={setActiveDragOverIndex}
                      handleDragOverComponent={handleDragOverComponent}
                      handleDropOnComponent={handleDropOnComponent}
                    />
                    <DropZoneLine index={idx + 1} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Properties Configuration Panel */}
        <div style={{ width: "18%", maxHeight: "calc(100vh - 130px)", overflowY: "auto" }} className="border-start bg-light p-3 text-start hide-scrollbar">
          {selectedComp ? (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                <span className="fw-bold text-dark text-uppercase small" style={{ letterSpacing: "0.5px", fontSize: "11px" }}>
                  Properties: {COMPONENT_TYPES.find((c) => c.type === selectedComp.type)?.name || selectedComp.type}
                </span>
                <button className="btn btn-xs btn-outline-secondary" onClick={() => setSelectedCompId(null)}>Deselect</button>
              </div>

              {/* Tab Navigation */}
              <div className="d-flex border-bottom mb-2">
                {["Content", "Style", "Layout", "Animate"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setRightTab(t)}
                    className={`btn btn-xs pb-2 pt-1 font-semibold rounded-0 flex-grow-1 text-center ${rightTab === t ? "border-bottom border-2 border-dark text-dark" : "text-muted"}`}
                    style={{ borderBottom: rightTab === t ? "2px solid #2249b7" : "none", fontSize: "11px", padding: "4px 8px" }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Content Tab */}
              {rightTab === "Content" && (
                <div className="d-flex flex-column gap-3">
                  {/* Layout Presets Selection Dropdown (Only for blocks with multiple layout styles) */}
                  {["header-nav", "hero-split", "feature-showcase", "footer", "features", "testimonials", "pricing"].includes(selectedComp.type) && (
                    <div className="bg-wa-soft p-2 rounded border border-primary border-opacity-10">
                      <label className="form-label fw-bold text-wa mb-1" style={{ fontSize: "10px" }}>CHOOSE PRESET STYLE</label>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        value={selectedComp.content?.presetType || "type1"}
                        onChange={(e) => updateSelectedContent("presetType", e.target.value)}
                      >
                        <option value="type1">Style 1: Default Professional</option>
                        <option value="type2">Style 2: Centered Layout</option>
                        <option value="type3">Style 3: Minimal Compact / Flipped</option>
                        <option value="type4">Style 4: Double Decker / Media Video</option>
                        <option value="type5">Style 5: Premium Dark Accent / Floating</option>
                        <option value="type6">Style 6: Glassmorphic Overlay</option>
                        <option value="type7">Style 7: Neumorphic Soft Bordered</option>
                        <option value="type8">Style 8: Left Heavy Bold Sidebar-Style</option>
                        <option value="type9">Style 9: Gradient Highlight Banner</option>
                        <option value="type10">Style 10: Clean Borderless Grid</option>
                        <option value="type11">Style 11: High-Contrast Dark Accent</option>
                      </select>
                    </div>
                  )}
                  {renderPropertyFields(selectedComp, updateSelectedContent, updateSelectedStyle, formsList)}
                </div>
              )}

              {/* Style Tab */}
              {rightTab === "Style" && (
                <div className="d-flex flex-column gap-3">
                  {/* Typography - only relevant for text-related types */}
                  {["heading", "paragraph", "label", "quote", "badge", "bullet-list", "alert-bar", "icon-list", "text-link", "title-group"].includes(selectedComp.type) && (
                    <div className="border-bottom pb-3">
                      <h6 className="fw-bold text-secondary small mb-2">Typography</h6>
                      <div className="d-flex flex-column gap-2">
                        <div>
                          <label className="form-label small text-muted">Font Family</label>
                          <select className="form-select form-select-sm" value={selectedComp.styles?.fontFamily || "Inherit"} onChange={(e) => updateSelectedStyle("fontFamily", e.target.value)}>
                            <option value="Inherit">Theme Default</option>
                            <option value="Outfit">Outfit</option>
                            <option value="Inter">Inter</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Lora">Lora</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label small text-muted">Font Size</label>
                          <input type="text" className="form-control form-control-sm" placeholder="e.g. 16px, 2rem" value={selectedComp.styles?.fontSize || ""} onChange={(e) => updateSelectedStyle("fontSize", e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label small text-muted">Font Weight</label>
                          <select className="form-select form-select-sm" value={selectedComp.styles?.fontWeight || "400"} onChange={(e) => updateSelectedStyle("fontWeight", e.target.value)}>
                            <option value="300">Light (300)</option>
                            <option value="400">Regular (400)</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semi Bold (600)</option>
                            <option value="700">Bold (700)</option>
                            <option value="900">Black (900)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label small text-muted">Alignment</label>
                          <select className="form-select form-select-sm" value={selectedComp.styles?.textAlign || "left"} onChange={(e) => updateSelectedStyle("textAlign", e.target.value)}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Colors & Background */}
                  <div className="border-bottom pb-3">
                    <h6 className="fw-bold text-secondary small mb-2">Colors & Background</h6>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small text-muted">Bg Color</label>
                        <input
                          type="color"
                          className="form-control form-control-sm form-control-color w-100"
                          value={selectedComp.styles?.backgroundColor || "#ffffff"}
                          onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small text-muted">Text Color</label>
                        <input
                          type="color"
                          className="form-control form-control-sm form-control-color w-100"
                          value={selectedComp.styles?.textColor || "#000000"}
                          onChange={(e) => updateSelectedStyle("textColor", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Borders & Shadows */}
                  <div>
                    <h6 className="fw-bold text-secondary small mb-2">Borders & Shadows</h6>
                    <div className="d-flex flex-column gap-2">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label small text-muted">Border Radius</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. 12px"
                            value={selectedComp.styles?.borderRadius || ""}
                            onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted">Border Width</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. 1px"
                            value={selectedComp.styles?.borderWidth || ""}
                            onChange={(e) => updateSelectedStyle("borderWidth", e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="form-label small text-muted">Border Color</label>
                        <input
                          type="color"
                          className="form-control form-control-sm form-control-color w-100"
                          value={selectedComp.styles?.borderColor || "#cbd5e1"}
                          onChange={(e) => updateSelectedStyle("borderColor", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label small text-muted">Shadow Depth</label>
                        <select
                          className="form-select form-select-sm"
                          value={selectedComp.styles?.boxShadow || "none"}
                          onChange={(e) => updateSelectedStyle("boxShadow", e.target.value)}
                        >
                          <option value="none">None</option>
                          <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Soft Shadow</option>
                          <option value="0 10px 15px -3px rgba(0,0,0,0.1)">Medium Shadow</option>
                          <option value="0 20px 25px -5px rgba(0,0,0,0.15)">Large Shadow</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Layout Tab */}
              {rightTab === "Layout" && (
                <div className="d-flex flex-column gap-3">
                  <h6 className="fw-bold text-secondary small mb-2">Dimensions & Margins</h6>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-muted">Width</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={selectedComp.styles?.width || "100%"}
                        onChange={(e) => updateSelectedStyle("width", e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-muted">Height</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={selectedComp.styles?.height || "auto"}
                        onChange={(e) => updateSelectedStyle("height", e.target.value)}
                      />
                    </div>
                    <div className="col-6 mt-2">
                      <label className="form-label small text-muted">Padding T/B</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 20px"
                        value={selectedComp.styles?.paddingTop || "0px"}
                        onChange={(e) => {
                          updateSelectedStyle("paddingTop", e.target.value);
                          updateSelectedStyle("paddingBottom", e.target.value);
                        }}
                      />
                    </div>
                    <div className="col-6 mt-2">
                      <label className="form-label small text-muted">Padding L/R</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 20px"
                        value={selectedComp.styles?.paddingLeft || "0px"}
                        onChange={(e) => {
                          updateSelectedStyle("paddingLeft", e.target.value);
                          updateSelectedStyle("paddingRight", e.target.value);
                        }}
                      />
                    </div>
                    <div className="col-6 mt-2">
                      <label className="form-label small text-muted">Margin T/B</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 10px"
                        value={selectedComp.styles?.marginTop || "0px"}
                        onChange={(e) => {
                          updateSelectedStyle("marginTop", e.target.value);
                          updateSelectedStyle("marginBottom", e.target.value);
                        }}
                      />
                    </div>
                    <div className="col-6 mt-2">
                      <label className="form-label small text-muted">Margin L/R</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. auto"
                        value={selectedComp.styles?.marginLeft || "auto"}
                        onChange={(e) => {
                          updateSelectedStyle("marginLeft", e.target.value);
                          updateSelectedStyle("marginRight", e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  
                  <hr className="my-2" />
                  <h6 className="fw-bold text-secondary small mb-2">Free Positioning Coordinates</h6>
                  <div className="row g-2">
                    <div className="col-4">
                      <label className="form-label small text-muted mb-0" style={{ fontSize: "10px" }}>Left (X)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. 50px"
                        value={selectedComp.styles?.left || "0px"}
                        onChange={(e) => updateSelectedStyle("left", e.target.value)}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small text-muted mb-0" style={{ fontSize: "10px" }}>Top (Y)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. 50px"
                        value={selectedComp.styles?.top || "0px"}
                        onChange={(e) => updateSelectedStyle("top", e.target.value)}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small text-muted mb-0" style={{ fontSize: "10px" }}>Layer (Z)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm font-monospace"
                        value={selectedComp.styles?.zIndex || 10}
                        onChange={(e) => updateSelectedStyle("zIndex", e.target.value)}
                      />
                    </div>
                  </div>

                  <hr className="my-2" />
                  <h6 className="fw-bold text-secondary small mb-2">Align Element</h6>
                  <div className="d-flex flex-column gap-2">
                    {/* Horizontal Alignment */}
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="small text-muted" style={{ fontSize: "10px" }}>Horizontal:</span>
                      <div className="btn-group btn-group-sm">
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("left")} title="Align Left">
                          <i className="bi bi-align-start"></i>
                        </button>
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("center-x")} title="Align Center">
                          <i className="bi bi-align-center"></i>
                        </button>
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("right")} title="Align Right">
                          <i className="bi bi-align-end"></i>
                        </button>
                      </div>
                    </div>

                    {/* Vertical Alignment */}
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="small text-muted" style={{ fontSize: "10px" }}>Vertical:</span>
                      <div className="btn-group btn-group-sm">
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("top")} title="Align Top">
                          <i className="bi bi-align-top"></i>
                        </button>
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("center-y")} title="Align Middle">
                          <i className="bi bi-align-middle"></i>
                        </button>
                        <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => alignElement("bottom")} title="Align Bottom">
                          <i className="bi bi-align-bottom"></i>
                        </button>
                      </div>
                    </div>

                    <hr className="my-1.5" />
                    <h6 className="fw-bold text-secondary small mb-2">Anchor Presets (Page Docking)</h6>
                    
                    {/* Anchor 3x3 visual grid */}
                    <div className="d-flex justify-content-center my-1">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px", width: "135px" }}>
                        {/* Row 1 */}
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("left-top")} title="Top Left">↖</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("top-center")} title="Top Center">↑</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("right-top")} title="Top Right">↗</button>
                        
                        {/* Row 2 */}
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("left-center")} title="Left Center">←</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("center-page")} title="Center Page">✛</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("right-center")} title="Right Center">→</button>
                        
                        {/* Row 3 */}
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("left-bottom")} title="Bottom Left">↙</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("bottom-center")} title="Bottom Center">↓</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary p-1 fw-bold fs-6 d-flex align-items-center justify-content-center" style={{ height: "30px", width: "40px" }} onClick={() => alignElement("right-bottom")} title="Bottom Right">↘</button>
                      </div>
                    </div>
                    
                    <span className="text-secondary mt-1.5" style={{ fontSize: "10px", lineHeight: "1.2", display: "block" }}>
                      💡 <strong>Tip:</strong> Click an anchor above to snap the element or drag it freely by its body.
                    </span>
                  </div>
                </div>
              )}

              {/* Animate Tab */}
              {rightTab === "Animate" && (
                <div className="d-flex flex-column gap-3">
                  <h6 className="fw-bold text-secondary small mb-2">Animations & Transitions</h6>
                  <div className="d-flex flex-column gap-2">
                    <div>
                      <label className="form-label small text-muted">Animation Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={selectedComp.animation?.type || "none"}
                        onChange={(e) => updateSelectedAnimation("type", e.target.value)}
                      >
                        <option value="none">None (Static)</option>
                        <option value="fade-in">Fade In</option>
                        <option value="slide-up">Slide Up</option>
                        <option value="zoom-in">Zoom In</option>
                        <option value="bounce">Bounce</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label small text-muted">Duration</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 0.5s"
                        value={selectedComp.animation?.duration || "0.5s"}
                        onChange={(e) => updateSelectedAnimation("duration", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted">Delay</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 0s"
                        value={selectedComp.animation?.delay || "0s"}
                        onChange={(e) => updateSelectedAnimation("delay", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <h5 className="fw-bold text-dark mb-1 pb-2 border-bottom small text-uppercase" style={{ fontSize: "11px" }}>Global Settings</h5>

              <div>
                <label className="form-label mb-1">Canvas Width</label>
                <div className="d-flex gap-1 mb-2">
                  <select
                    className="form-select form-select-sm"
                    value={["100%", "1200px", "960px", "768px"].includes(page.canvasWidth) ? page.canvasWidth : "custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "custom") {
                        updateCanvasWidth(val);
                      }
                    }}
                  >
                    <option value="100%">Full Width (100%)</option>
                    <option value="1200px">Wide Desktop (1200px)</option>
                    <option value="960px">Boxed Layout (960px)</option>
                    <option value="768px">Centered Tablet (768px)</option>
                    <option value="custom">Custom Width...</option>
                  </select>
                  {(!["100%", "1200px", "960px", "768px"].includes(page.canvasWidth) || page.canvasWidth === "custom") && (
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ width: "80px" }}
                      placeholder="e.g. 850px"
                      value={page.canvasWidth || "100%"}
                      onChange={(e) => updateCanvasWidth(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="form-label mb-1">Canvas Height</label>
                <div className="d-flex gap-1">
                  <select
                    className="form-select form-select-sm"
                    value={["750px", "1000px", "1200px", "1500px", "2000px"].includes(page.canvasHeight) ? page.canvasHeight : "custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "custom") {
                        updateCanvasHeight(val);
                      }
                    }}
                  >
                    <option value="750px">Standard (750px)</option>
                    <option value="1000px">Medium (1000px)</option>
                    <option value="1200px">Tall (1200px)</option>
                    <option value="1500px">Extra Tall (1500px)</option>
                    <option value="2000px">Double Height (2000px)</option>
                    <option value="custom">Custom Height...</option>
                  </select>
                  {(!["750px", "1000px", "1200px", "1500px", "2000px"].includes(page.canvasHeight) || page.canvasHeight === "custom") && (
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ width: "80px" }}
                      placeholder="e.g. 750px"
                      value={page.canvasHeight || "750px"}
                      onChange={(e) => updateCanvasHeight(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="alert bg-accent-soft text-wa px-3 py-2 small border-0 mt-3" style={{ borderRadius: "8px" }}>
                <i className="bi bi-info-circle-fill me-2"></i>
                Click on any canvas block elements in the center window to inspect and edit details.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Quick Add Element modal */}
      {showQuickAddMenu !== null && (
        <Modal title="Choose Element to Insert" onClose={() => setShowQuickAddMenu(null)}>
          <div className="row g-3" style={{ maxHeight: "400px", overflowY: "auto" }}>
            {COMPONENT_TYPES.map((item) => (
              <div className="col-6" key={item.type}>
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-3 py-2.5 px-3"
                  onClick={() => insertComponentAt(showQuickAddMenu, item)}
                  style={{ borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <i className={`bi ${item.icon} fs-5 text-wa`}></i>
                  <span className="small fw-semibold">{item.name}</span>
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Custom HTML Add/Edit Modal */}
      {showHtmlModal && (
        <Modal title={page.components.some((c) => c.type === "custom-html") ? "Edit Custom HTML Code" : "Add Custom HTML Code"} onClose={() => setShowHtmlModal(false)}>
          <div className="d-flex flex-column gap-3 text-start">
            <p className="small text-muted">
              Paste your custom HTML code below (including any custom scripts, styles, forms, or embed iframes).
            </p>
            <textarea
              className="form-control font-monospace"
              style={{ fontSize: "11.5px", lineHeight: "1.4" }}
              rows={16}
              value={customHtmlCode}
              onChange={(e) => setCustomHtmlCode(e.target.value)}
              placeholder="e.g. <iframe src='https://example.com' style='width:100%; height:500px;'></iframe>"
              autoFocus
            />
            <div className="d-flex justify-content-end gap-2 mt-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowHtmlModal(false)}>Cancel</button>
              <button className="btn btn-wa btn-sm fw-bold text-white" onClick={handleAddCustomHtml}>
                {page.components.some((c) => c.type === "custom-html") ? "Update Canvas" : "Add to Canvas"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* JSON Schema Import Modal */}
      {showJsonModal && (
        <Modal title="JSON Schema Editor" onClose={() => setShowJsonModal(false)}>
          <div className="d-flex flex-column gap-3">
            <p className="small text-muted">
              Here is the JSON representation of your Landing Page. You can copy it, save it, or paste an existing schema below to import.
            </p>
            <textarea
              className="form-control font-monospace"
              style={{ fontSize: "11px" }}
              rows={12}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <div className="d-flex justify-content-end gap-2 mt-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowJsonModal(false)}>Cancel</button>
              <button className="btn btn-wa btn-sm" onClick={handleImportJson}>Import Schema</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
          <div className="d-flex flex-column gap-3 text-start">
            <p className="small text-muted mb-0">{confirmDialog.message}</p>
            <div className="d-flex justify-content-end gap-2 mt-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                if (confirmDialog.onCancel) confirmDialog.onCancel();
                setConfirmDialog(null);
              }}>Cancel</button>
              <button className="btn btn-wa btn-sm fw-bold text-white" onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(null);
              }}>OK</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Visual Live Preview Modal */}
      {showPreview && (
        <Modal 
          title="Landing Page Preview" 
          onClose={() => setShowPreview(false)}
          size="xl"
          bodyStyle={{ padding: 0, background: "#f8fafc" }}
        >
          {/* Viewport Toggles for Preview */}
          <div className="bg-white border-bottom p-2 d-flex justify-content-center gap-2" style={{ zIndex: 10 }}>
            <button 
              className={`btn btn-sm ${previewViewport === "desktop" ? "btn-primary text-white" : "btn-light border"}`} 
              onClick={() => setPreviewViewport("desktop")}
              style={{ fontSize: "11px", borderRadius: "6px" }}
            >
              <i className="bi bi-laptop me-1"></i>Desktop
            </button>
            <button 
              className={`btn btn-sm ${previewViewport === "tablet" ? "btn-primary text-white" : "btn-light border"}`} 
              onClick={() => setPreviewViewport("tablet")}
              style={{ fontSize: "11px", borderRadius: "6px" }}
            >
              <i className="bi bi-tablet me-1"></i>Tablet
            </button>
            <button 
              className={`btn btn-sm ${previewViewport === "mobile" ? "btn-primary text-white" : "btn-light border"}`} 
              onClick={() => setPreviewViewport("mobile")}
              style={{ fontSize: "11px", borderRadius: "6px" }}
            >
              <i className="bi bi-phone me-1"></i>Mobile
            </button>
          </div>

          {/* Scrollable Preview Frame */}
          <div className="p-4 d-flex justify-content-center align-items-start overflow-auto" style={{ height: "calc(100vh - 200px)", background: "#f1f5f9" }}>
            <div 
              className="bg-white shadow border" 
              style={{
                width: previewViewport === "mobile" ? "375px" : previewViewport === "tablet" ? "768px" : "100%",
                minHeight: "600px",
                transition: "all 0.3s ease-in-out",
                borderRadius: previewViewport === "mobile" ? "24px" : previewViewport === "tablet" ? "12px" : "0px",
                overflow: "hidden"
              }}
            >
              {page.components.length === 0 ? (
                <div className="text-center py-5 text-muted">No components to preview.</div>
              ) : (
                <div className="d-flex flex-column text-start" style={{ fontFamily: page.theme.fontFamily || "system-ui" }}>
                  {page.components.map((comp) => {
                    const wrapperStyle = {
                      paddingTop: comp.styles?.paddingTop || "0px",
                      paddingBottom: comp.styles?.paddingBottom || "0px",
                      paddingLeft: comp.styles?.paddingLeft || "0px",
                      paddingRight: comp.styles?.paddingRight || "0px",
                      marginTop: comp.styles?.marginTop || "0px",
                      marginBottom: comp.styles?.marginBottom || "0px",
                      marginLeft: comp.styles?.marginLeft || "auto",
                      marginRight: comp.styles?.marginRight || "auto",
                      width: comp.styles?.width || "100%",
                      height: comp.styles?.height || "auto",
                      backgroundColor: comp.styles?.backgroundColor || "transparent",
                      color: comp.styles?.textColor || "inherit",
                      borderRadius: comp.styles?.borderRadius || page.theme.borderRadius || "0px",
                      borderWidth: comp.styles?.borderWidth || "0px",
                      borderStyle: comp.styles?.borderWidth ? "solid" : "none",
                      borderColor: comp.styles?.borderColor || "transparent",
                      boxShadow: comp.styles?.boxShadow || "none"
                    };

                    return (
                      <div key={comp.id} style={wrapperStyle}>
                        {renderComponentLive(
                          comp, 
                          page.theme, 
                          formsList, 
                          previewFormValues, 
                          setPreviewFormValues,
                          (co, f) => co.content?.[f] || "",
                          (co, f, cl, st) => <img src={co.content?.[f]} className={cl} style={st} alt="" />,
                          (co, i) => co.content?.menuLinks?.[i]?.label || ""
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CSS overrides */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .hide-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 10px;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.24);
        }
        .hide-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
        }
        .hover-preset-card:hover {
          border-color: #2249b7 !important;
          background-color: #f1f5f9 !important;
          transform: translateX(4px);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }

        .hover-builder-block {
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .hover-builder-block:hover {
          border: 2px dashed var(--accent);
          background-color: rgba(34, 73, 183, 0.01);
        }
        .border-builder-selected {
          border: 2.5px solid var(--accent) !important;
          background-color: rgba(34, 73, 183, 0.03) !important;
        }
        .builder-component-actions {
          display: none;
          position: absolute;
          right: 2px;
          top: -24px;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          z-index: 100;
          align-items: center;
        }
        .hover-builder-block:hover .builder-component-actions,
        .border-builder-selected .builder-component-actions {
          display: flex !important;
        }
        .border-dashed {
          border: 1px dashed #cbd5e1;
          background: #ffffff;
          transition: all 0.15s ease-in-out;
        }
        .border-dashed:hover {
          border-color: var(--accent);
          background-color: var(--accent-soft);
          transform: translateY(-1px);
        }
        .btn-xs {
          padding: 2px 6px;
          font-size: 11px;
        }
        .builder-dropzone-marker .dropzone-add-btn {
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.2s ease-in-out;
        }
        .builder-dropzone-marker:hover .dropzone-add-btn {
          opacity: 1;
          transform: scale(1);
        }
        .resize-handle-ew:hover {
          background: rgba(34, 73, 183, 0.35) !important;
        }
        .resize-handle-ns:hover {
          background: rgba(34, 73, 183, 0.35) !important;
        }
        .image-editable-wrapper:hover .image-edit-hover-overlay {
          opacity: 1 !important;
        }
        .builder-editable-text:hover {
          background: rgba(34, 73, 183, 0.05);
          border-bottom-color: rgba(34, 73, 183, 0.8) !important;
        }
        .builder-editable-text:focus {
          background: #ffffff;
          border-bottom: 2px solid #2249b7 !important;
          box-shadow: 0 0 0 3px rgba(34, 73, 183, 0.15);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

// Helper to render type-specific style mockups visually
const renderStyleMockup = (type, styleId) => {
  const isDark = styleId === "type5" || styleId === "type11";
  
  if (type === "header-nav") {
    switch (styleId) {
      case "type1": // Style 1: Left Logo + Right Menu & CTA button
        return (
          <div className="w-100 bg-white border rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <span className="fw-bold text-dark" style={{ fontSize: "8px" }}>Brand</span>
            <div className="d-flex gap-1" style={{ fontSize: "5.5px", color: "#64748b" }}>
              <span>Home</span>
              <span>About</span>
            </div>
            <div className="text-white bg-primary px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "5.5px", background: "#3b82f6" }}>CTA</div>
          </div>
        );
      case "type2": // Style 2: Centered links menu, right CTA
        return (
          <div className="w-100 bg-white border rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <span className="fw-bold text-dark" style={{ fontSize: "8px" }}>Brand</span>
            <div className="d-flex gap-1 mx-auto" style={{ fontSize: "5.5px", color: "#64748b" }}>
              <span>Home • Services • About</span>
            </div>
            <div className="text-white bg-primary px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "5.5px", background: "#3b82f6" }}>CTA</div>
          </div>
        );
      case "type3": // Style 3: Minimal centered stacked logo and menu links below (no cta)
        return (
          <div className="w-100 bg-white border rounded p-1.5 d-flex flex-column align-items-center justify-content-center gap-1 shadow-xs" style={{ height: "65px" }}>
            <span className="fw-bold text-dark" style={{ fontSize: "8.5px" }}>Brand Logo</span>
            <div className="d-flex gap-2" style={{ fontSize: "5.5px", color: "#64748b" }}>
              <span>HOME</span>
              <span>SERVICES</span>
              <span>ABOUT</span>
            </div>
          </div>
        );
      case "type4": // Style 4: Double Decker utility top-bar + main menu header
        return (
          <div className="w-100 bg-white border rounded p-0 d-flex flex-column shadow-xs overflow-hidden" style={{ height: "65px" }}>
            <div className="bg-light px-2 py-0.5 d-flex justify-content-between border-bottom text-muted" style={{ height: "14px", fontSize: "5px" }}>
              <span>📞 Phone | ✉ Email</span>
              <span>🔗 Socials</span>
            </div>
            <div className="p-1.5 d-flex justify-content-between align-items-center flex-grow-1">
              <span className="fw-bold text-dark" style={{ fontSize: "7px" }}>Brand</span>
              <div className="d-flex gap-1" style={{ fontSize: "5.5px", color: "#64748b" }}>
                <span>Home</span>
                <span>About</span>
              </div>
            </div>
          </div>
        );
      case "type5": // Style 5: Glassmorphic Floating Header
        return (
          <div className="w-100 rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
            <div className="w-100 h-90 rounded-pill border shadow-xs d-flex justify-content-between align-items-center px-2 bg-white" style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(2.5px)", borderColor: "#e2e8f0" }}>
              <span className="fw-bold text-dark" style={{ fontSize: "7px" }}>Brand</span>
              <span style={{ fontSize: "5px", color: "#64748b" }}>Home • About</span>
              <div className="text-white bg-primary px-1.5 py-0.5 rounded-pill fw-semibold" style={{ fontSize: "5px", background: "#3b82f6" }}>CTA</div>
            </div>
          </div>
        );
      case "type6": // Style 6: Glassmorphic Overlay
        return (
          <div className="w-100 border rounded p-1.5 d-flex align-items-center justify-content-center position-relative shadow-xs" style={{ height: "65px", background: "linear-gradient(135deg, #ec4899 0%, #3b82f6 100%)", overflow: "hidden", borderColor: "transparent" }}>
            <div className="w-90 h-80 rounded shadow-xs d-flex justify-content-between align-items-center px-2" style={{ background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(2.5px)", border: "1px solid rgba(255,255,255,0.3)" }}>
              <span className="fw-bold text-white" style={{ fontSize: "7px" }}>Brand</span>
              <span className="text-white" style={{ fontSize: "5px" }}>Home • About</span>
              <div className="text-primary bg-white px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "5px" }}>CTA</div>
            </div>
          </div>
        );
      case "type7": // Style 7: Neumorphic Soft Bordered
        return (
          <div className="w-100 rounded p-1.5 d-flex align-items-center justify-content-between shadow-xs" style={{ height: "65px", background: "#f1f5f9" }}>
            <div className="rounded bg-light shadow-xs d-flex justify-content-between align-items-center px-2 w-100" style={{ height: "36px", boxShadow: "inset 2px 2px 5px #cbd5e1, inset -2px -2px 5px #ffffff", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "6px", color: "#475569" }}>Brand</span>
              <span style={{ fontSize: "5px", color: "#64748b" }}>Home • About</span>
              <div className="text-white bg-primary px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "5px", background: "#3b82f6" }}>CTA</div>
            </div>
          </div>
        );
      case "type8": // Style 8: Left Heavy Bold Sidebar-Style
        return (
          <div className="w-100 bg-white border rounded p-1.5 d-flex align-items-center shadow-xs" style={{ height: "65px", borderLeft: "4px solid #2249b7" }}>
            <div className="d-flex justify-content-between align-items-center w-100 ms-1">
              <span className="fw-bold" style={{ fontSize: "8px", color: "#1e293b" }}>BRAND</span>
              <div className="border border-dark rounded px-1.5 py-0.5 fw-semibold" style={{ fontSize: "5px" }}>Outline</div>
            </div>
          </div>
        );
      case "type9": // Style 9: Gradient Highlight Banner
        return (
          <div className="w-100 border rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", borderColor: "transparent" }}>
            <span className="fw-bold text-white" style={{ fontSize: "8px" }}>Brand</span>
            <span className="text-white opacity-75" style={{ fontSize: "5.5px" }}>Home • About</span>
            <div className="text-primary bg-white px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "6px" }}>Join</div>
          </div>
        );
      case "type10": // Style 10: Clean Borderless Grid
        return (
          <div className="w-100 bg-white border rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <span className="fw-bold text-secondary" style={{ fontSize: "8px" }}>Brand</span>
            <div className="d-flex gap-1.5" style={{ fontSize: "6px", color: "#64748b" }}>
              <span>Home</span>
              <span>About</span>
            </div>
          </div>
        );
      case "type11": // Style 11: High-Contrast Dark Accent
        return (
          <div className="w-100 bg-black border rounded p-1.5 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px", borderColor: "#eab308" }}>
            <span className="fw-bold text-white" style={{ fontSize: "8px" }}>Brand</span>
            <div className="text-warning border border-warning px-1.5 py-0.5 rounded fw-semibold" style={{ fontSize: "5.5px" }}>Alert</div>
          </div>
        );
      default:
        return null;
    }
  }

  // For Hero sections
  if (type && type.includes("hero")) {
    switch (styleId) {
      case "type1": // Default Style 1: Left Text + Right Form Solid Card Box
        return (
          <div className="w-100 bg-white border rounded p-2 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start">
              <span className="fw-bold text-dark" style={{ fontSize: "8px", lineHeight: "1" }}>Grow Sales</span>
              <span className="text-muted" style={{ fontSize: "5.5px", lineHeight: "1" }}>Smart Leads CRM</span>
            </div>
            <div className="border rounded bg-light p-1 d-flex flex-column gap-1" style={{ width: "38%", height: "90%" }}>
              <div className="bg-white border rounded" style={{ width: "100%", height: "6px" }}></div>
              <div className="bg-primary text-white text-center rounded d-flex align-items-center justify-content-center fw-semibold" style={{ width: "100%", height: "9px", fontSize: "5px", background: "#3b82f6" }}>Send</div>
            </div>
          </div>
        );
      case "type2": // Style 2: Parallax photo background with Blur panel Form on right
        return (
          <div className="w-100 border rounded p-2 d-flex justify-content-between align-items-center shadow-xs overflow-hidden position-relative" style={{ height: "65px", backgroundImage: "linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.65)), url(https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=120&q=80)", backgroundSize: "cover" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start text-white">
              <span className="fw-bold" style={{ fontSize: "7px", lineHeight: "1" }}>Image Hero</span>
              <span style={{ fontSize: "5px", opacity: 0.8 }}>Parallax theme</span>
            </div>
            <div className="rounded p-1 d-flex flex-column gap-1 text-white" style={{ width: "38%", height: "90%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(1.5px)", border: "1px solid rgba(255,255,255,0.3)" }}>
              <div className="bg-white rounded" style={{ width: "100%", height: "4px", opacity: 0.8 }}></div>
              <div className="bg-primary text-white text-center rounded d-flex align-items-center justify-content-center" style={{ width: "100%", height: "8px", fontSize: "4.5px" }}>Submit</div>
            </div>
          </div>
        );
      case "type3": // Style 3: Flipped Column Layout (Form on Left, Text/Intro on Right)
        return (
          <div className="w-100 bg-white border rounded p-2 d-flex flex-row-reverse justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start">
              <span className="fw-bold" style={{ fontSize: "8px", color: "#8b5cf6", lineHeight: "1" }}>Scale Team</span>
              <span className="text-muted" style={{ fontSize: "5.5px", lineHeight: "1" }}>Get productivity</span>
            </div>
            <div className="border rounded bg-light p-1 d-flex flex-column gap-1" style={{ width: "38%", height: "90%" }}>
              <div className="bg-white border rounded" style={{ width: "100%", height: "6px" }}></div>
              <div className="bg-purple text-white text-center rounded d-flex align-items-center justify-content-center fw-semibold" style={{ width: "100%", height: "9px", fontSize: "5px", background: "#8b5cf6" }}>Submit</div>
            </div>
          </div>
        );
      case "type4": // Style 4: Left Text + Right Video Embed Split (No Form)
        return (
          <div className="w-100 bg-white border rounded p-2 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start">
              <span className="fw-bold" style={{ fontSize: "8px", lineHeight: "1" }}>Watch Demo</span>
              <span className="text-muted" style={{ fontSize: "5.5px" }}>Video preview</span>
            </div>
            <div className="bg-dark border rounded position-relative d-flex align-items-center justify-content-center shadow-xs" style={{ width: "38%", height: "90%", background: "#475569" }}>
              <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: "12px", height: "12px" }}>
                <i className="bi bi-play-fill text-white" style={{ fontSize: "8px", marginLeft: "0.5px" }}></i>
              </div>
            </div>
          </div>
        );
      case "type5": // Style 5: Full Width Centered Hero with Wave Overlay (No Split)
        return (
          <div className="w-100 border rounded p-2 d-flex flex-column align-items-center justify-content-center gap-1 shadow-xs text-white" style={{ height: "65px", background: "linear-gradient(135deg, #6366f1 0%, #1e1b4b 100%)", borderColor: "transparent" }}>
            <span className="fw-bold text-center text-warning" style={{ fontSize: "8px", lineHeight: "1" }}>Gradient Centered</span>
            <span className="text-center" style={{ fontSize: "5px", opacity: 0.9 }}>Wave overlay preview</span>
            <div className="bg-white text-primary text-center rounded px-2 fw-bold" style={{ height: "9px", fontSize: "5.5px", lineHeight: "1.6", color: "#6366f1" }}>Action CTA</div>
          </div>
        );
      case "type6": // Style 6: Glassmorphic Overlay Hero
        return (
          <div className="w-100 border rounded p-1.5 d-flex align-items-center justify-content-center position-relative shadow-xs" style={{ height: "65px", background: "linear-gradient(135deg, #ec4899 0%, #3b82f6 100%)", overflow: "hidden", borderColor: "transparent" }}>
            <div className="w-90 h-90 rounded p-1 d-flex flex-column align-items-center justify-content-center gap-1 shadow-xs" style={{ background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(3.5px)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <span className="fw-bold text-white text-center" style={{ fontSize: "7.5px", lineHeight: "1" }}>Modern App</span>
              <span className="text-white text-center" style={{ fontSize: "5px", opacity: 0.9 }}>Frosted layout</span>
            </div>
          </div>
        );
      case "type7": // Style 7: Neumorphic Soft Bordered Hero
        return (
          <div className="w-100 rounded p-2 d-flex align-items-center justify-content-between shadow-xs" style={{ height: "65px", background: "#f1f5f9" }}>
            <span className="fw-bold text-secondary" style={{ fontSize: "7px", lineHeight: "1" }}>Soft UI Hero</span>
            <div className="rounded bg-light shadow-xs d-flex align-items-center justify-content-center" style={{ width: "45%", height: "30px", boxShadow: "2px 2px 4px #cbd5e1, -2px -2px 4px #ffffff" }}>
              <span style={{ fontSize: "5px", color: "#2249b7" }}>Soft CTA</span>
            </div>
          </div>
        );
      case "type8": // Style 8: Left Heavy Bold Sidebar-Style
        return (
          <div className="w-100 bg-white border rounded p-2 d-flex align-items-center shadow-xs" style={{ height: "65px", borderLeft: "4px solid #2249b7" }}>
            <div className="d-flex flex-column gap-1 w-100 ms-1 text-start">
              <span className="fw-bold text-dark" style={{ fontSize: "8px", lineHeight: "1" }}>Enterprise Hero</span>
              <span className="text-muted" style={{ fontSize: "5.5px" }}>Accent border style</span>
            </div>
          </div>
        );
      case "type9": // Style 9: Gradient Highlight Banner
        return (
          <div className="w-100 border rounded p-2 d-flex align-items-center justify-content-center shadow-xs" style={{ height: "65px", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", borderColor: "transparent" }}>
            <div className="d-flex flex-column align-items-center justify-content-center gap-1 text-center">
              <span className="fw-bold text-white" style={{ fontSize: "8px", lineHeight: "1" }}>Gradient Accent</span>
              <div className="bg-white text-primary text-center rounded px-2" style={{ height: "9px", fontSize: "5.5px", lineHeight: "1.6" }}>Action</div>
            </div>
          </div>
        );
      case "type10": // Style 10: Clean Borderless Grid
        return (
          <div className="w-100 bg-white border rounded p-2 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start">
              <span className="fw-bold" style={{ fontSize: "8px", lineHeight: "1" }}>Minimalist Layout</span>
              <span className="text-muted" style={{ fontSize: "5.5px" }}>Clean borders</span>
            </div>
            <div className="border-bottom border-dark text-dark text-center fw-semibold" style={{ fontSize: "6.5px" }}>Read More →</div>
          </div>
        );
      case "type11": // Style 11: High-Contrast Dark Accent
        return (
          <div className="w-100 bg-black border rounded p-2 d-flex justify-content-between align-items-center shadow-xs" style={{ height: "65px", borderColor: "#eab308" }}>
            <div className="d-flex flex-column gap-1 w-55 text-start">
              <span className="fw-bold text-warning" style={{ fontSize: "8px", lineHeight: "1" }}>Contrast Alert</span>
              <span className="text-secondary" style={{ fontSize: "5.5px" }}>Yellow black theme</span>
            </div>
            <div className="text-warning border border-warning text-center rounded px-1 fw-semibold" style={{ fontSize: "6px" }}>Warning</div>
          </div>
        );
      default:
        return null;
    }
  }

  // Default layout for other components (cards, pricing, testimonials, FAQ, footer, etc.)
  const themeColor = styleId === "type1" ? "#3b82f6" : styleId === "type2" ? "#10b981" : styleId === "type3" ? "#8b5cf6" : styleId === "type5" ? "#f59e0b" : styleId === "type8" ? "#2249b7" : styleId === "type11" ? "#eab308" : "#6366f1";
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const borderCol = isDark ? "#475569" : "#e2e8f0";
  const textCol = isDark ? "#94a3b8" : "#64748b";

  if (styleId === "type6") {
    return (
      <div className="w-100 border rounded p-1.5 d-flex align-items-center justify-content-center shadow-xs" style={{ height: "65px", background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", borderColor: "transparent" }}>
        <div className="w-100 h-100 rounded d-flex flex-column gap-1 p-1.5 text-white text-start justify-content-center" style={{ background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(2.5px)", border: "1px solid rgba(255,255,255,0.2)" }}>
          <span className="fw-bold" style={{ fontSize: "7.5px", lineHeight: "1" }}>Glass Card</span>
          <span style={{ fontSize: "5.5px", opacity: 0.9 }}>Interactive modern style</span>
        </div>
      </div>
    );
  }

  if (styleId === "type7") {
    return (
      <div className="w-100 rounded p-1.5 d-flex gap-1.5 align-items-center shadow-xs" style={{ height: "65px", background: "#f1f5f9" }}>
        <div className="rounded bg-light shadow-xs flex-grow-1 p-1.5 text-start d-flex flex-column justify-content-center" style={{ height: "45px", boxShadow: "2px 2px 4px #cbd5e1, -2px -2px 4px #ffffff" }}>
          <span className="fw-bold" style={{ fontSize: "7px", color: "#475569", lineHeight: "1" }}>Soft Card</span>
          <span style={{ fontSize: "5.5px", color: "#64748b" }}>Neumorphic style preview</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-100 border rounded p-2 d-flex gap-2 align-items-center shadow-xs" 
      style={{ 
        height: "65px", 
        background: cardBg, 
        borderColor: styleId === "type11" ? "#eab308" : borderCol,
        borderLeft: styleId === "type8" ? `4px solid ${themeColor}` : undefined
      }}
    >
      <div className="rounded d-flex align-items-center justify-content-center text-white" style={{ width: "16px", height: "16px", background: themeColor, fontSize: "8px" }}>
        ★
      </div>
      <div className="flex-grow-1 d-flex flex-column gap-1 text-start">
        <span className="fw-bold" style={{ fontSize: "7.5px", color: isDark ? "#ffffff" : "#1e293b", lineHeight: "1" }}>Feature Card</span>
        <span style={{ fontSize: "5.5px", color: textCol, lineHeight: "1" }}>Style preview details</span>
      </div>
    </div>
  );
};

// Helper to execute embedded scripts inside custom HTML blocks
function CustomHtmlBlock({ html }) {
  const containerRef = React.useRef(null);
  const shadowRootRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: "open" });
    }

    const shadowRoot = shadowRootRef.current;
    shadowRoot.innerHTML = `
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
      <style>
        :host {
          display: block;
          width: 100%;
        }
      </style>
      <div class="w-100 h-100">${html}</div>
    `;

    const scripts = shadowRoot.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      document.body.appendChild(newScript);
      document.body.removeChild(newScript);
    });
  }, [html]);

  return <div ref={containerRef} className="w-100" style={{ height: "auto" }} />;
}

// Render component inside live canvas preview
function renderComponentLive(
  comp,
  theme,
  formsList,
  formValues,
  setFormValues,
  renderEditableText = (co, f, ta, cl, st) => co.content?.[f] || "",
  renderEditableImage = (co, f, cl, st) => <img src={co.content?.[f]} className={cl} style={st} alt="Img" />,
  renderEditableLink = (co, i, cl, st) => co.content?.menuLinks?.[i]?.label || ""
) {
  const c = comp.content || {};
  const pType = c.presetType || "type1";

  switch (comp.type) {
    case "custom-html": {
      return (
        <div className="w-100 position-relative" style={{ minHeight: "20px" }}>
          <CustomHtmlBlock html={c.htmlCode || "<div class='text-muted p-4 text-center border border-dashed rounded bg-light'>Empty HTML Block (Click to paste custom HTML)</div>"} />
        </div>
      );
    }
    case "header-nav": {
      // 5 Header variations
      if (pType === "type2") {
        // Style 2: Centered links menu, right CTA
        return (
          <header className="px-4 py-3 d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom w-100">
            {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
            <div className="d-flex align-items-center gap-4 mx-auto">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-muted small fw-bold" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
            {c.showButton && (
              <a href={c.buttonLink} className="btn btn-sm text-white" style={{ background: theme.primaryColor }}>
                {renderEditableText(comp, "buttonText", "span")}
              </a>
            )}
          </header>
        );
      } else if (pType === "type3") {
        // Style 3: Minimal centered stacked logo and menu links below (no cta)
        return (
          <header className="py-4 text-center border-bottom w-100 bg-white">
            {renderEditableImage(comp, "logoUrl", "mb-3", { maxHeight: c.logoWidth || "55px" })}
            <div className="d-flex justify-content-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-dark small fw-bold text-uppercase" style={{ textDecoration: "none", letterSpacing: "1px" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
          </header>
        );
      } else if (pType === "type4") {
        // Style 4: Double Decker utility top-bar + main menu header
        return (
          <div className="w-100 border-bottom bg-white">
            <div className="bg-light py-1.5 px-4 d-flex justify-content-between align-items-center border-bottom" style={{ fontSize: "11px" }}>
              <div className="text-muted">
                <i className="bi bi-telephone-fill me-1"></i> {renderEditableText(comp, "phone")} | <i className="bi bi-envelope-fill ms-2 me-1"></i> {renderEditableText(comp, "email")}
              </div>
              <div className="d-flex gap-2"><i className="bi bi-facebook"></i><i className="bi bi-instagram"></i><i className="bi bi-whatsapp"></i></div>
            </div>
            <header className="px-4 py-3 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "40px" })}
                <h6 className="fw-bold mb-0 text-dark">{renderEditableText(comp, "brandName")}</h6>
              </div>
              <div className="d-flex align-items-center gap-4">
                {(c.menuLinks || []).map((l, i) => (
                  <a key={i} href={l.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>
                    {renderEditableLink(comp, i)}
                  </a>
                ))}
              </div>
            </header>
          </div>
        );
      } else if (pType === "type5") {
        // Style 5: Glassmorphic Floating Header
        return (
          <header className="mx-3 my-3 p-3 d-flex justify-content-between align-items-center border shadow-sm rounded-4 w-100 bg-white" style={{
            background: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(8px)"
          }}>
            {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
            <div className="d-flex align-items-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
            <a href={c.buttonLink} className="btn btn-sm text-white px-3" style={{ background: theme.primaryColor, borderRadius: "20px" }}>
              {renderEditableText(comp, "buttonText", "span")}
            </a>
          </header>
        );
      } else if (pType === "type6") {
        // Style 6: Glassmorphic Overlay
        return (
          <header className="mx-3 my-2 p-3 d-flex justify-content-between align-items-center rounded-3 w-100 bg-white" style={{
            background: "rgba(255, 255, 255, 0.45)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.08)"
          }}>
            {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
            <div className="d-flex align-items-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-dark small fw-semibold" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
            <a href={c.buttonLink} className="btn btn-sm text-white px-3" style={{ background: theme.primaryColor, borderRadius: "8px" }}>
              {renderEditableText(comp, "buttonText", "span")}
            </a>
          </header>
        );
      } else if (pType === "type7") {
        // Style 7: Neumorphic Soft Bordered
        return (
          <header className="p-3 d-flex justify-content-between align-items-center rounded-3 w-100" style={{
            background: "#f1f5f9",
            boxShadow: "inset 2px 2px 5px #cbd5e1, inset -2px -2px 5px #ffffff",
            border: "1px solid #e2e8f0"
          }}>
            {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
            <div className="d-flex align-items-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-secondary small fw-bold" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
            <a href={c.buttonLink} className="btn btn-sm text-white shadow-sm" style={{ background: theme.primaryColor, borderRadius: "10px" }}>
              {renderEditableText(comp, "buttonText", "span")}
            </a>
          </header>
        );
      } else if (pType === "type8") {
        // Style 8: Left Heavy Bold Sidebar-Style
        return (
          <header className="p-3 d-flex justify-content-between align-items-center w-100" style={{ borderLeft: `6px solid ${theme.primaryColor}`, backgroundColor: "#f8fafc" }}>
            <div className="d-flex align-items-center gap-3">
              {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
              <span className="fw-black text-dark text-uppercase small">
                {renderEditableText(comp, "brandName")}
              </span>
            </div>
            <div className="d-flex align-items-center gap-3">
              <a href={c.buttonLink} className="btn btn-xs btn-outline-dark">
                {renderEditableText(comp, "buttonText", "span")}
              </a>
            </div>
          </header>
        );
      } else if (pType === "type9") {
        // Style 9: Gradient Highlight Banner
        return (
          <header className="p-3 d-flex justify-content-between align-items-center w-100 text-white rounded-3 shadow" style={{ background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #1e1b4b 100%)` }}>
            <span className="fw-bold fs-6 text-white">
              {renderEditableText(comp, "brandName", "span")}
            </span>
            <div className="d-flex align-items-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-white opacity-75 small fw-semibold" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
            <a href={c.buttonLink} className="btn btn-sm btn-light text-dark fw-bold">
              {renderEditableText(comp, "buttonText", "span")}
            </a>
          </header>
        );
      } else if (pType === "type10") {
        // Style 10: Clean Borderless Grid
        return (
          <header className="py-2 px-4 d-flex justify-content-between align-items-center w-100 bg-transparent">
            {renderEditableImage(comp, "logoUrl", "", { maxHeight: c.logoWidth || "45px" })}
            <div className="d-flex gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-secondary small" style={{ textDecoration: "none" }}>
                  {renderEditableLink(comp, i)}
                </a>
              ))}
            </div>
          </header>
        );
      } else if (pType === "type11") {
        // Style 11: High-Contrast Dark Accent
        return (
          <header className="px-4 py-3 d-flex justify-content-between align-items-center w-100 text-white" style={{ backgroundColor: "#0f172a" }}>
            <span className="fw-bold text-white">
              {renderEditableText(comp, "brandName")}
            </span>
            <a href={c.buttonLink} className="btn btn-sm btn-outline-warning">
              {renderEditableText(comp, "buttonText", "span")}
            </a>
          </header>
        );
      }

      // Default Style 1: Left Logo + Right Menu & CTA button
      return (
        <header className="px-4 py-3 d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom w-100">
          <div className="d-flex align-items-center gap-3">
            {renderEditableImage(comp, "logoUrl", "img-fluid", { maxHeight: c.logoWidth || "45px" })}
            <h5 className="fw-bold mb-0 text-dark">
              {renderEditableText(comp, "brandName")}
            </h5>
          </div>
          <div className="d-none d-md-flex align-items-center gap-4 text-start">
            {(c.menuLinks || []).map((link, i) => (
              <a key={i} href={link.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>
                {renderEditableLink(comp, i)}
              </a>
            ))}
            {c.showButton && (
              <a href={c.buttonLink} className="btn btn-sm text-white" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}>
                {renderEditableText(comp, "buttonText", "span")}
              </a>
            )}
          </div>
        </header>
      );
    }

    case "hero-split": {
      // Helper to render the form card box uniformly in the canvas editor
      const renderBuilderFormBox = (textClass = "", inputClass = "") => {
        return (
          <div className={`card p-4 border-0 shadow-sm ${textClass.includes("white") ? "bg-white bg-opacity-25 border border-secondary text-white" : "bg-white text-dark"}`} style={{ borderRadius: theme.borderRadius }}>
            <h5 className={`fw-bold text-center mb-3 ${textClass.includes("white") ? "text-white" : "text-dark"}`}>
              {renderEditableText(comp, "formTitle", "h5")}
            </h5>
            {c.wizardFormType ? (
              renderDynamicWizardForm(comp, theme, textClass, inputClass)
            ) : c.formType === "enquiry_form" && c.enquiryFormId ? (
              (() => {
                const targetForm = formsList.find((f) => String(f._id) === String(c.enquiryFormId));
                return targetForm ? (
                  renderEnquiryFormFieldsMockup(targetForm, theme, textClass, inputClass)
                ) : (
                  <div className="p-3 bg-light rounded text-start border border-dashed mt-3 text-dark">
                    <span className="badge bg-danger mb-2">Form Not Found</span>
                    <div className="small text-muted">Enquiry form could not be loaded.</div>
                  </div>
                );
              })()
            ) : (
              <div className="d-flex flex-column gap-3 mt-3 text-dark">
                <input type="text" className="form-control" placeholder="Full Name" disabled />
                <input type="tel" className="form-control" placeholder="Phone Number" disabled />
                <button className="btn text-white w-100 mt-2 fw-semibold" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}>
                  Submit
                </button>
              </div>
            )}
          </div>
        );
      };

      if (pType === "type2") {
        // Style 2: Parallax photo background with Blur panel Form on right
        return (
          <div className="position-relative text-start py-5 px-4 text-white w-100" style={{
            backgroundImage: `linear-gradient(rgba(15,23,42,0.7), rgba(15,23,42,0.7)), url(${c.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed"
          }}>
            <div className="container py-4">
              <div className="row g-5 align-items-center">
                <div className="col-md-7">
                  <h1 className="display-4 fw-bold mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                  <p className="lead">{renderEditableText(comp, "subtitle", "p")}</p>
                </div>
                <div className="col-md-5">
                  {renderBuilderFormBox("text-white", "bg-transparent text-white border-secondary text-white-placeholder")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type3") {
        // Style 3: Flipped Column Layout (Form on Left, Text/Intro on Right)
        return (
          <div className="w-100 py-5 px-4 bg-light text-dark">
            <div className="container">
              <div className="row g-5 align-items-center">
                <div className="col-md-5 order-2 order-md-1">
                  {renderBuilderFormBox("text-dark", "")}
                </div>
                <div className="col-md-7 order-1 order-md-2">
                  <span className="badge bg-primary px-3 py-1.5 mb-2 text-uppercase">{renderEditableText(comp, "badgeText")}</span>
                  <h1 className="fw-bold text-dark display-5 mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                  <p className="text-muted lead">{renderEditableText(comp, "subtitle", "p")}</p>
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type4") {
        // Style 4: Left Text + Right Video Embed Split (No Form, keeps video embed)
        return (
          <div className="w-100 py-5 px-4 bg-white text-dark border-bottom">
            <div className="container">
              <div className="row g-5 align-items-center">
                <div className="col-lg-6">
                  <span className="badge bg-danger text-uppercase px-3 py-2 mb-3">{renderEditableText(comp, "badgeText")}</span>
                  <h1 className="fw-bold display-4 mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                  <p className="text-muted lead mb-4">{renderEditableText(comp, "subtitle", "p")}</p>
                  {c.ctaText && <a href={c.ctaLink} className="btn btn-lg text-white" style={{ background: theme.primaryColor }}>{renderEditableText(comp, "ctaText", "span")}</a>}
                </div>
                <div className="col-lg-6">
                  <div className="shadow-lg border overflow-hidden rounded-4" style={{ height: "320px" }}>
                    <iframe src={c.videoUrl} width="100%" height="100%" style={{ border: 0 }} title="hero-video"></iframe>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type5") {
        // Style 5: Full Width Centered Hero with Wave Overlay
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #1e1b4b 100%)`
          }}>
            <div className="container py-5" style={{ maxWidth: "800px" }}>
              <span className="badge bg-warning text-dark px-3 py-2 mb-3 text-uppercase font-semibold">{renderEditableText(comp, "badgeText")}</span>
              <h1 className="display-3 fw-bold mb-4">{renderEditableText(comp, "title", "h1")}</h1>
              <p className="lead fs-5 mb-4" style={{ opacity: 0.9, lineHeight: "1.8" }}>{renderEditableText(comp, "subtitle", "p")}</p>
              
              <div className="mx-auto text-start shadow-lg" style={{ maxWidth: "450px" }}>
                {renderBuilderFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type6") {
        // Style 6: Glassmorphic Overlay Hero
        return (
          <div className="w-100 py-5 px-4 text-center" style={{
            backgroundImage: `url(${c.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}>
            <div className="container py-5 rounded-4 shadow-lg text-dark bg-white" style={{
              maxWidth: "800px",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.4)"
            }}>
              <span className="badge bg-primary text-white px-3 py-2 mb-3 text-uppercase font-semibold">{renderEditableText(comp, "badgeText")}</span>
              <h1 className="display-4 fw-bold mb-4">{renderEditableText(comp, "title", "h1")}</h1>
              <p className="lead fs-5 mb-4">{renderEditableText(comp, "subtitle", "p")}</p>
              
              <div className="mx-auto text-start shadow" style={{ maxWidth: "450px" }}>
                {renderBuilderFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type7") {
        // Style 7: Neumorphic Soft Bordered Hero
        return (
          <div className="w-100 py-5 px-4 text-center" style={{ backgroundColor: "#f1f5f9" }}>
            <div className="container py-5 rounded-4" style={{
              maxWidth: "800px",
              boxShadow: "10px 10px 30px #cbd5e1, -10px -10px 30px #ffffff",
              border: "1px solid #e2e8f0",
              background: "#f1f5f9"
            }}>
              <span className="text-secondary fw-bold text-uppercase d-block mb-2 small">{renderEditableText(comp, "badgeText")}</span>
              <h1 className="fw-black text-dark mb-4">{renderEditableText(comp, "title", "h1")}</h1>
              <p className="text-muted mb-4">{renderEditableText(comp, "subtitle", "p")}</p>
              
              <div className="mx-auto text-start" style={{ maxWidth: "450px" }}>
                {renderBuilderFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type8") {
        // Style 8: Left Heavy Bold Sidebar-Style
        return (
          <div className="w-100 py-5 px-4 text-start bg-light" style={{ borderLeft: `8px solid ${theme.primaryColor}` }}>
            <div className="container py-4">
              <div className="row g-5 align-items-center">
                <div className="col-md-7">
                  <span className="badge bg-dark text-white px-3 py-1 mb-3 text-uppercase font-semibold">{renderEditableText(comp, "badgeText")}</span>
                  <h1 className="display-4 fw-bold text-dark mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                  <p className="lead text-muted fs-5 mb-4">{renderEditableText(comp, "subtitle", "p")}</p>
                </div>
                <div className="col-md-5">
                  {renderBuilderFormBox("text-dark", "")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type9") {
        // Style 9: Gradient Highlight Banner
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #06b6d4 100%)`
          }}>
            <div className="container py-5">
              <span className="badge bg-white text-dark px-3 py-2 mb-3 text-uppercase">{renderEditableText(comp, "badgeText")}</span>
              <h1 className="display-4 fw-bold mb-4">{renderEditableText(comp, "title", "h1")}</h1>
              <p className="lead fs-5 mb-4" style={{ opacity: 0.9 }}>{renderEditableText(comp, "subtitle", "p")}</p>
              
              <div className="mx-auto text-start shadow-lg" style={{ maxWidth: "450px" }}>
                {renderBuilderFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type10") {
        // Style 10: Clean Borderless Grid
        return (
          <div className="w-100 py-5 px-4 bg-white text-start">
            <div className="container py-4">
              <div className="row align-items-center g-5">
                <div className="col-md-7">
                  <span className="text-secondary fw-semibold text-uppercase small d-block mb-2">{renderEditableText(comp, "badgeText")}</span>
                  <h1 className="display-4 fw-bold text-dark mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                  <p className="lead text-muted">{renderEditableText(comp, "subtitle", "p")}</p>
                </div>
                <div className="col-md-5">
                  {renderBuilderFormBox("text-dark", "")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type11") {
        // Style 11: High-Contrast Dark Accent
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{ backgroundColor: "#0f172a" }}>
            <div className="container py-5">
              <span className="badge bg-warning text-dark px-3 py-2 mb-3 text-uppercase">{renderEditableText(comp, "badgeText")}</span>
              <h1 className="display-4 fw-bold text-white mb-4">{renderEditableText(comp, "title", "h1")}</h1>
              <p className="lead text-secondary mb-4">{renderEditableText(comp, "subtitle", "p")}</p>
              
              <div className="mx-auto text-start" style={{ maxWidth: "450px" }}>
                {renderBuilderFormBox("text-white", "bg-transparent text-white border-secondary text-white-placeholder")}
              </div>
            </div>
          </div>
        );
      }

      // Default Style 1: Left Text + Right Form Solid Card Box
      return (
        <div className="position-relative overflow-hidden text-start py-5 px-4 text-white w-100" style={{
          backgroundImage: `linear-gradient(rgba(15,23,42,0.85), rgba(15,23,42,0.85)), url(${c.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}>
          <div className="container py-4">
            <div className="row align-items-center g-5">
              <div className="col-lg-7 text-start">
                <span className="badge bg-danger px-3 py-2 fw-bold text-uppercase mb-3" style={{ fontSize: "11px", letterSpacing: "1px", borderRadius: "4px" }}>
                  {renderEditableText(comp, "badgeText")}
                </span>
                <h1 className="display-4 fw-bold mb-3">{renderEditableText(comp, "title", "h1")}</h1>
                <p className="lead fs-5" style={{ opacity: 0.9, lineHeight: "1.7" }}>{renderEditableText(comp, "subtitle", "p")}</p>
                {c.ctaText && (
                  <a href={c.ctaLink} className="btn btn-lg text-white mt-3 fw-bold px-4 py-2" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius, textDecoration: "none" }}>
                    {renderEditableText(comp, "ctaText", "span")}
                  </a>
                )}
              </div>
              <div className="col-lg-5" id="contact-form">
                {renderBuilderFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "feature-showcase": {
      // 5 Focus Cards Variations
      if (pType === "type2") {
        // Style 2: 3-Column horizontal cards layout
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-4">
                  <div className="card h-100 p-4 border bg-white shadow-sm" style={{ borderRadius: theme.borderRadius }}>
                    <div className="badge bg-light text-primary fw-bold fs-5 px-3 py-2 align-self-start mb-3" style={{ borderRadius: "50%", color: theme.primaryColor }}>{item.num}</div>
                    <h5 className="fw-bold text-dark">{item.heading}</h5>
                    <p className="text-muted small mb-0">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type3") {
        // Style 3: Timeline Layout with central progress line
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4 text-center">{c.title}</h3>
            <div className="position-relative ps-4 border-start border-2 border-primary" style={{ marginLeft: "20px" }}>
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="mb-4 position-relative">
                  <div className="position-absolute text-white d-flex align-items-center justify-content-center fw-bold" style={{
                    width: "28px", height: "28px", borderRadius: "50%", background: theme.primaryColor, left: "-35px", top: "0px"
                  }}>{item.num}</div>
                  <h5 className="fw-bold text-dark mb-1">{item.heading}</h5>
                  <p className="text-muted small mb-0">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type4") {
        // Style 4: Neon/Dark Theme Grid cards
        return (
          <div className="w-100 py-5 px-4 bg-slate-900 text-white text-start" style={{ background: "#0b1329" }}>
            <div className="container">
              <h3 className="fw-bold text-white mb-4">{c.title}</h3>
              <div className="row g-4">
                {(c.items || []).map((item, idx) => (
                  <div key={idx} className="col-md-4">
                    <div className="p-4 border-2 border-primary rounded-4 bg-slate-800" style={{ borderColor: theme.primaryColor }}>
                      <span className="text-uppercase text-secondary fw-bold display-6 d-block mb-2" style={{ color: "#38bdf8" }}>{item.num}</span>
                      <h5 className="fw-bold text-white mb-2">{item.heading}</h5>
                      <p className="text-muted small mb-0">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type5") {
        // Style 5: Hover revealing minimalist grid list
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-6 border-bottom pb-3 mb-2">
                  <div className="d-flex align-items-center gap-3">
                    <h2 className="fw-bold text-muted mb-0">{item.num}</h2>
                    <div>
                      <h6 className="fw-bold mb-1 text-dark">{item.heading}</h6>
                      <p className="text-muted small mb-0">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type6") {
        // Style 6: Glassmorphic Overlay Feature Cards
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4 text-dark">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-6">
                  <div className="p-3 border rounded-3 h-100" style={{
                    background: "rgba(255, 255, 255, 0.4)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255, 255, 255, 0.25)"
                  }}>
                    <span className="badge bg-primary text-white mb-2">{item.num}</span>
                    <h6 className="fw-bold text-dark">{item.heading}</h6>
                    <p className="text-muted small mb-0">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type7") {
        // Style 7: Neumorphic Soft Bordered Grid
        return (
          <div className="container py-4 text-start w-100" style={{ backgroundColor: "#f1f5f9" }}>
            <h3 className="fw-bold mb-4 text-center">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-4">
                  <div className="p-3 rounded-4 h-100 text-center" style={{
                    boxShadow: "6px 6px 15px #cbd5e1, -6px -6px 15px #ffffff",
                    background: "#f1f5f9"
                  }}>
                    <div className="fw-black text-wa display-6 mb-2">{item.num}</div>
                    <h6 className="fw-bold text-dark">{item.heading}</h6>
                    <p className="text-muted small mb-0">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type8") {
        // Style 8: Left Heavy Bold Sidebar-Style List
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4" style={{ borderLeft: `5px solid ${theme.primaryColor}`, paddingLeft: "12px" }}>{c.title}</h3>
            <div className="d-flex flex-column gap-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-light rounded d-flex gap-3 align-items-center">
                  <span className="fw-black text-secondary fs-4">{item.num}</span>
                  <div>
                    <h6 className="fw-bold text-dark mb-0">{item.heading}</h6>
                    <p className="text-muted small mb-0">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type9") {
        // Style 9: Gradient Highlight Banner Cards
        return (
          <div className="container py-4 text-start w-100">
            <h3 className="fw-bold mb-4 text-center">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-6">
                  <div className="p-4 rounded-3 h-100 text-white shadow-sm" style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #0369a1 100%)`
                  }}>
                    <span className="badge bg-white text-dark mb-2">{item.num}</span>
                    <h6 className="fw-bold text-white">{item.heading}</h6>
                    <p className="text-white opacity-75 small mb-0">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type10") {
        // Style 10: Clean Borderless Grid
        return (
          <div className="container py-4 text-start w-100 bg-white">
            <h4 className="fw-bold mb-4 text-dark">{c.title}</h4>
            <div className="row g-4">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-4">
                  <span className="text-secondary small fw-bold">{item.num}</span>
                  <h6 className="fw-bold text-dark mt-1">{item.heading}</h6>
                  <p className="text-muted small mb-0">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type11") {
        // Style 11: High-Contrast Dark Accent
        return (
          <div className="w-100 py-4 px-3 text-start text-white" style={{ backgroundColor: "#0f172a" }}>
            <h3 className="fw-bold mb-4 text-warning">{c.title}</h3>
            <div className="row g-3">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-6 p-3 border border-secondary rounded">
                  <span className="badge bg-warning text-dark mb-2">{item.num}</span>
                  <h6 className="fw-bold text-white">{item.heading}</h6>
                  <p className="text-secondary small mb-0">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Default Style 1: Stacked side-by-side flex boxes
      return (
        <div className="container py-4 text-start w-100">
          <h2 className="fw-bold mb-4">{c.title}</h2>
          <div className="row g-4">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="col-md-6 d-flex gap-3 align-items-start p-3 bg-light rounded-4 border border-light">
                <div className="display-6 fw-bold text-accent" style={{ color: theme.primaryColor, opacity: 0.8, fontSize: "2rem" }}>
                  {item.num}
                </div>
                <div>
                  <h5 className="fw-bold mb-1 text-dark" style={{ fontSize: "16px" }}>{item.heading}</h5>
                  <p className="text-muted mb-0 small" style={{ lineHeight: "1.6" }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "heading": {
      return (
        <div className="w-100" style={{
          textAlign: comp.styles?.textAlign || "left",
          color: comp.styles?.textColor || "inherit",
          fontSize: comp.styles?.fontSize || "32px",
          fontWeight: comp.styles?.fontWeight || "700",
          fontStyle: comp.styles?.fontStyle || "normal"
        }}>
          {c.text}
        </div>
      );
    }

    case "paragraph": {
      return (
        <div className="w-100" style={{
          textAlign: comp.styles?.textAlign || "left",
          color: comp.styles?.textColor || "inherit",
          fontSize: comp.styles?.fontSize || "16px",
          fontWeight: comp.styles?.fontWeight || "400",
          fontStyle: comp.styles?.fontStyle || "normal",
          lineHeight: "1.7"
        }}>
          {c.text}
        </div>
      );
    }

    case "logo": {
      return (
        <div className="w-100" style={{ textAlign: c.align || "left" }}>
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="Logo" className="img-fluid" style={{ maxWidth: c.logoWidth || "120px" }} />
          ) : (
            <div className="p-3 bg-light text-muted small">No Logo Image Specified</div>
          )}
        </div>
      );
    }

    case "image": {
      return (
        <div className="w-100" style={{ textAlign: c.align || "center" }}>
          {c.imageUrl ? (
            <img
              src={c.imageUrl}
              alt={c.altText || "Image"}
              className="img-fluid shadow-sm"
              style={{
                borderRadius: comp.styles?.borderRadius || theme.borderRadius,
                maxWidth: c.width || "100%",
                height: c.height || "auto",
                objectFit: "cover"
              }}
            />
          ) : (
            <div className="p-4 bg-light text-muted small rounded">No Image URL Specified</div>
          )}
        </div>
      );
    }

    case "button": {
      return (
        <div className="w-100" style={{ textAlign: c.align || "left" }}>
          <button
            className="btn text-white px-4 py-2"
            style={{
              background: c.btnColor || theme.primaryColor,
              color: c.textColor || "#fff",
              borderRadius: comp.styles?.borderRadius || theme.borderRadius,
              fontSize: comp.styles?.fontSize || "16px",
              fontWeight: comp.styles?.fontWeight || "600",
              width: c.width === "100%" ? "100%" : "auto"
            }}
          >
            {c.iconClass && <i className={`bi ${c.iconClass} me-2`}></i>}
            {c.text}
          </button>
        </div>
      );
    }

    case "divider": {
      return (
        <div className="w-100">
          <hr style={{
            borderColor: c.color || "#e2e8f0",
            borderWidth: c.thickness || "2px",
            width: c.width || "100%",
            margin: "0 auto",
            opacity: 1
          }} />
        </div>
      );
    }

    case "spacer": {
      return <div style={{ height: c.height || "40px" }} />;
    }

    case "icon": {
      return (
        <div className="w-100" style={{ textAlign: c.align || "left" }}>
          <i className={`bi ${c.iconClass || "bi-star-fill"}`} style={{ color: c.color || "#2249b7", fontSize: c.size || "40px" }}></i>
        </div>
      );
    }

    case "social-icons": {
      const iconStyle = { color: c.iconColor || "#475569", fontSize: c.iconSize || "24px", textDecoration: "none" };
      return (
        <div className="w-100" style={{ textAlign: c.align || "center" }}>
          <div className="d-inline-flex gap-3">
            {c.facebook && <a href={c.facebook} style={iconStyle}><i className="bi bi-facebook"></i></a>}
            {c.instagram && <a href={c.instagram} style={iconStyle}><i className="bi bi-instagram"></i></a>}
            {c.linkedin && <a href={c.linkedin} style={iconStyle}><i className="bi bi-linkedin"></i></a>}
            {c.whatsapp && <a href={c.whatsapp} style={iconStyle}><i className="bi bi-whatsapp"></i></a>}
            {c.twitter && <a href={c.twitter} style={iconStyle}><i className="bi bi-twitter"></i></a>}
          </div>
        </div>
      );
    }

    case "form-container": {
      const targetForm = formsList.find((f) => String(f._id) === String(c.enquiryFormId));
      return (
        <div className="w-100">
          <div className="card border-0 shadow-sm p-4 mx-auto" style={{ maxWidth: "550px", borderRadius: theme.borderRadius }}>
            <h4 className="fw-bold mb-2 text-center text-dark">{c.title}</h4>
            {c.subtitle && <p className="text-muted text-center small mb-4">{c.subtitle}</p>}

            {c.formType === "enquiry_form" && targetForm ? (
              renderEnquiryFormFieldsMockup(targetForm, theme, "", "")
            ) : (
              <div className="d-flex flex-column gap-3 text-start">
                <input type="text" className="form-control" placeholder="Full Name" value={formValues.name} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} />
                <input type="tel" className="form-control" placeholder="Phone Number" value={formValues.phone} onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))} />
                <button type="button" className="btn text-white w-100 mt-2 fw-semibold" style={{ background: c.submitButtonColor || theme.primaryColor, borderRadius: theme.borderRadius }}>
                  {c.submitButtonText || "Submit Inquiry"}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    case "payment-form": {
      return (
        <div className="w-100 text-start">
          <div className="card border-0 shadow mx-auto p-4 bg-white" style={{ maxWidth: "500px", borderRadius: "16px" }}>
            <h5 className="fw-bold text-dark mb-1 text-center">{c.title}</h5>
            <p className="text-muted small text-center mb-3">{c.subtitle}</p>

            <div className="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}>
              <div>
                <span className="text-dark small fw-bold d-block">{c.itemName}</span>
                <span className="text-muted small" style={{ fontSize: "11px" }}>Immediate checkout fee</span>
              </div>
              <h4 className="fw-bold text-wa mb-0" style={{ color: theme.primaryColor }}>{c.priceText}</h4>
            </div>

            <div className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small text-dark mb-1">Card Holder Name</label>
                <input type="text" className="form-control" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="form-label small text-dark mb-1">Card Details</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-credit-card"></i></span>
                  <input type="text" className="form-control" placeholder="4111 2222 3333 4444" />
                </div>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small text-dark mb-1">Expiry</label>
                  <input type="text" className="form-control" placeholder="MM/YY" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-dark mb-1">CVV</label>
                  <input type="text" className="form-control" placeholder="123" />
                </div>
              </div>
              <button type="button" className="btn text-white w-100 mt-3 fw-bold btn-lg" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}>
                <i className="bi bi-shield-lock-fill me-2"></i> {c.buttonText}
              </button>
              <div className="d-flex justify-content-center align-items-center gap-3 mt-3 text-muted small" style={{ fontSize: "11px" }}>
                <span><i className="bi bi-lock-fill text-success me-1"></i> SSL SECURE</span>
                <span><i className="bi bi-patch-check-fill text-success me-1"></i> PCI COMPLIANT</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "iframe": {
      return (
        <div className="w-100 text-center">
          {c.iframeUrl ? (
            <div className="shadow-sm rounded border overflow-hidden" style={{ height: c.height || "400px", width: c.width || "100%" }}>
              <iframe src={c.iframeUrl} width="100%" height="100%" style={{ border: 0 }} title="iframe-embed"></iframe>
            </div>
          ) : (
            <div className="p-4 bg-light text-muted small rounded border">No Iframe Source URL Specified</div>
          )}
        </div>
      );
    }

    case "features": {
      return (
        <div className="container py-4 text-center w-100">
          <h3 className="fw-bold mb-4">{c.title}</h3>
          <div className="row g-4">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-4" key={idx}>
                <div className="card h-100 p-4 border-0 shadow-sm" style={{ borderRadius: theme.borderRadius }}>
                  <i className={`bi ${item.icon || "bi-star"} fs-3 mb-2 text-wa`} style={{ color: theme.primaryColor }}></i>
                  <h5 className="fw-bold text-dark">{item.title}</h5>
                  <p className="text-muted small mb-0">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "testimonials": {
      return (
        <div className="container py-4 text-center w-100">
          <h3 className="fw-bold mb-4">{c.title}</h3>
          <div className="row g-3 justify-content-center">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-5" key={idx}>
                <div className="card h-100 p-4 border-0 shadow-sm text-start" style={{ borderRadius: theme.borderRadius }}>
                  <p className="text-muted italic mb-3">"{item.text}"</p>
                  <div className="d-flex align-items-center gap-3">
                    <img src={item.photo} alt={item.name} className="rounded-circle border" style={{ width: "40px", height: "40px", objectFit: "cover" }} />
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">{item.name}</h6>
                      <span className="text-muted small" style={{ fontSize: "11px" }}>{item.role}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "faq": {
      return (
        <div className="container py-4 text-start w-100" style={{ maxWidth: "700px" }}>
          <h3 className="fw-bold mb-4 text-center">{c.title}</h3>
          <div className="accordion d-flex flex-column gap-2">
            {(c.items || []).map((item, idx) => (
              <div className="card border p-3" key={idx} style={{ borderRadius: theme.borderRadius }}>
                <h6 className="fw-bold mb-2 text-dark d-flex gap-2">
                  <i className="bi bi-patch-question text-wa" style={{ color: theme.primaryColor }}></i>
                  {item.q}
                </h6>
                <p className="text-muted mb-0 small ps-4">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "pricing": {
      return (
        <div className="container py-4 text-center w-100">
          <h3 className="fw-bold mb-4">{c.title}</h3>
          <div className="row g-4 justify-content-center">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-4" key={idx}>
                <div className={`card h-100 p-4 border ${item.highlight ? "border-2 shadow" : "border-1"}`}
                  style={{
                    borderRadius: theme.borderRadius,
                    borderColor: item.highlight ? theme.primaryColor : "#e2e8f0"
                  }}>
                  <h4 className="fw-bold text-dark">{item.name}</h4>
                  <div className="my-3">
                    <span className="display-6 fw-bold text-dark">{item.price}</span>
                    <span className="text-muted small"> / {item.period}</span>
                  </div>
                  <ul className="list-unstyled text-muted small my-3 flex-grow-1">
                    {(item.features || []).map((f, i) => (
                      <li className="mb-2" key={i}><i className="bi bi-check2 text-success me-2"></i>{f}</li>
                    ))}
                  </ul>
                  <button className="btn w-100" style={{ background: item.highlight ? theme.primaryColor : "transparent", color: item.highlight ? "#fff" : theme.primaryColor, border: `1px solid ${theme.primaryColor}`, borderRadius: theme.borderRadius }}>
                    {item.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "footer": {
      // 5 Footer variations
      if (pType === "type2") {
        // Style 2: Site map multi column footer
        return (
          <footer className="w-100 bg-dark text-light py-5 px-4" style={{ background: "#0f172a" }}>
            <div className="container text-start">
              <div className="row g-4">
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">{c.brandName || "Acme Academy"}</h6>
                  <p className="small text-muted">Empowering generations through high-quality visual inquiry based modern teaching frameworks.</p>
                </div>
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">Core Programs</h6>
                  <ul className="list-unstyled small text-muted d-flex flex-column gap-1">
                    <li>Early Years Curriculum</li>
                    <li>Primary Academy</li>
                    <li>High School Science & STEM</li>
                  </ul>
                </div>
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">Contact Support</h6>
                  <div className="small text-muted">{c.address}</div>
                  <div className="small text-muted mt-2">{c.phone} | {c.email}</div>
                </div>
              </div>
              <div className="border-top border-secondary pt-3 mt-4 text-center small text-muted">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type3") {
        // Style 3: Newsletter focused Footer
        return (
          <footer className="w-100 bg-light text-dark py-4 px-4 border-top">
            <div className="container">
              <div className="row g-4 align-items-center justify-content-between text-start">
                <div className="col-md-5">
                  <h5 className="fw-bold text-dark mb-1">Stay updated with admissions</h5>
                  <p className="text-muted small mb-0">Subscribe to our monthly newsletters and events tracker.</p>
                </div>
                <div className="col-md-6">
                  <div className="input-group">
                    <input type="email" className="form-control form-control-sm" placeholder="Enter email address" />
                    <button className="btn btn-sm btn-primary text-white" style={{ background: theme.primaryColor }}>Subscribe</button>
                  </div>
                </div>
              </div>
              <div className="border-top mt-4 pt-3 text-center small text-muted">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type4") {
        // Style 4: Dark Map Footer
        return (
          <footer className="w-100 bg-secondary text-light py-5 px-4" style={{ background: "#111827" }}>
            <div className="container text-start">
              <div className="row g-4">
                <div className="col-md-6">
                  <h5 className="fw-bold mb-3 text-white">Find Us on Campus</h5>
                  <div className="rounded overflow-hidden" style={{ height: "180px" }}>
                    <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3508.8354084534726!2d77.38722421507797!3d28.484551982476563!2m3!1f0!2f0!3f0!3m2!1i1024!2i769!3f0!3m2!1i1024!2i769!3f0!3m2!1i1012!2i1089!3m2!1a100!2f0!3f0!3m2!1d28.484552!2d77.3894129" width="100%" height="100%" style={{ border: 0 }}></iframe>
                  </div>
                </div>
                <div className="col-md-6 d-flex flex-column justify-content-between">
                  <div>
                    <h5 className="fw-bold text-white mb-2">Acme Offices</h5>
                    <p className="small text-muted">{c.address}</p>
                    <p className="small text-muted"><i className="bi bi-telephone-fill text-wa me-1"></i> {c.phone}</p>
                  </div>
                  <div className="small text-muted mt-3">{c.copyright}</div>
                </div>
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type5") {
        // Style 5: Stacked Center minimal social brand stack
        return (
          <footer className="w-100 py-5 bg-white border-top text-center">
            <img src={c.logoUrl || "https://clarwynschool.com/wp-content/themes/astra/assets/images/logo.png"} alt="Logo" className="mb-3" style={{ maxHeight: "50px" }} />
            <p className="small text-muted max-w-sm mx-auto mb-3">{c.address}</p>
            <div className="d-flex justify-content-center gap-3 mb-3">
              <i className="bi bi-facebook fs-5 text-muted"></i>
              <i className="bi bi-instagram fs-5 text-muted"></i>
              <i className="bi bi-whatsapp fs-5 text-muted"></i>
            </div>
            <div className="small text-muted font-semibold">{c.copyright}</div>
          </footer>
        );
      } else if (pType === "type6") {
        // Style 6: Glassmorphic Overlay Footer
        return (
          <footer className="mx-3 my-3 p-4 border rounded-4 w-100 text-center" style={{
            background: "rgba(255, 255, 255, 0.45)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.08)"
          }}>
            <p className="small text-dark fw-bold mb-2">{c.address}</p>
            <p className="small text-muted mb-3">{c.phone} | {c.email}</p>
            <div className="small text-dark fw-bold">{c.copyright}</div>
          </footer>
        );
      } else if (pType === "type7") {
        // Style 7: Neumorphic Soft Bordered Footer
        return (
          <footer className="p-4 text-center rounded-3 w-100" style={{
            background: "#f1f5f9",
            boxShadow: "inset 4px 4px 10px #cbd5e1, inset -4px -4px 10px #ffffff",
            border: "1px solid #e2e8f0"
          }}>
            <p className="small text-secondary mb-1">{c.address}</p>
            <p className="small text-secondary font-semibold mb-3">{c.phone} • {c.email}</p>
            <div className="small text-muted">{c.copyright}</div>
          </footer>
        );
      } else if (pType === "type8") {
        // Style 8: Left Heavy Bold Sidebar-Style Footer
        return (
          <footer className="p-4 w-100 text-start bg-light" style={{ borderLeft: `6px solid ${theme.primaryColor}` }}>
            <h6 className="fw-bold text-dark mb-2">Office Address</h6>
            <p className="small text-muted mb-3">{c.address}</p>
            <div className="small text-secondary font-semibold">{c.copyright}</div>
          </footer>
        );
      } else if (pType === "type9") {
        // Style 9: Gradient Highlight Banner Footer
        return (
          <footer className="p-5 text-center text-white w-100" style={{ background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #0369a1 100%)` }}>
            <h5 className="fw-bold text-white mb-2">{c.brandName || "KnowVato"}</h5>
            <p className="small text-white opacity-75 mb-4">{c.address}</p>
            <div className="small text-white opacity-50">{c.copyright}</div>
          </footer>
        );
      } else if (pType === "type10") {
        // Style 10: Clean Borderless Grid Footer
        return (
          <footer className="py-4 px-3 w-100 bg-white border-top text-start">
            <div className="row g-3">
              <div className="col-md-8">
                <span className="small text-muted d-block">{c.address}</span>
                <span className="small text-secondary font-semibold">{c.phone} | {c.email}</span>
              </div>
              <div className="col-md-4 text-md-end text-muted small">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type11") {
        // Style 11: High-Contrast Dark Accent Footer
        return (
          <footer className="p-5 w-100 text-white" style={{ backgroundColor: "#0f172a" }}>
            <div className="row g-4 align-items-center">
              <div className="col-md-6 text-start">
                <h5 className="fw-bold text-warning mb-2">{c.brandName || "Admissions"}</h5>
                <p className="small text-secondary mb-0">{c.address}</p>
              </div>
              <div className="col-md-6 text-md-end text-secondary small">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      }

      // Default Style 1: Standard Minimal Contacts row
      return (
        <div className="container py-4 text-center w-100">
          <div className="row g-3 justify-content-between text-md-start mb-3" style={{ color: "inherit" }}>
            <div className="col-md-5">
              <p className="small mb-0" style={{ opacity: 0.8 }}><i className="bi bi-geo-alt-fill me-2"></i>{c.address}</p>
            </div>
            <div className="col-md-5 text-md-end">
              <p className="small mb-1" style={{ opacity: 0.8 }}><i className="bi bi-telephone-fill me-2"></i>{c.phone}</p>
              <p className="small mb-0" style={{ opacity: 0.8 }}><i className="bi bi-envelope-fill me-2"></i>{c.email}</p>
            </div>
          </div>
          <div className="border-top pt-3 text-center small" style={{ opacity: 0.6 }}>
            {c.copyright}
          </div>
        </div>
      );
    }

    default:
      return renderNewComponentLive(comp, theme, formsList, formValues, setFormValues);
  }
}

// Render property configurations inside right property pane
function renderPropertyFields(comp, updateContent, updateStyle, formsList) {
  const c = comp.content || {};

  switch (comp.type) {
    case "custom-html":
      return (
        <>
          <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center justify-content-between">
              <label className="form-label mb-0 fw-bold text-dark">HTML / Embed Code</label>
              <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: "9px" }}>HTML5</span>
            </div>
            <textarea
              className="form-control font-monospace border border-secondary-subtle"
              style={{ fontSize: "11.5px", lineHeight: "1.4", background: "#f8fafc" }}
              rows={30}
              placeholder="Paste your custom HTML here..."
              value={c.htmlCode || ""}
              onChange={(e) => updateContent("htmlCode", e.target.value)}
            />
          </div>
        </>
      );

    case "header-nav":
      return (
        <>
          <div>
            <label className="form-label">Brand/School Name</label>
            <input className="form-control form-control-sm" value={c.brandName || ""} onChange={(e) => updateContent("brandName", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Logo Image URL</label>
            <input className="form-control form-control-sm" value={c.logoUrl || ""} onChange={(e) => updateContent("logoUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Logo Width Size</label>
            <input className="form-control form-control-sm" value={c.logoWidth || ""} onChange={(e) => updateContent("logoWidth", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Phone Support</label>
            <input className="form-control form-control-sm" value={c.phone || ""} onChange={(e) => updateContent("phone", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email Support</label>
            <input className="form-control form-control-sm" value={c.email || ""} onChange={(e) => updateContent("email", e.target.value)} />
          </div>
          <div>
            <label className="form-label">CTA Button Label</label>
            <input className="form-control form-control-sm" value={c.buttonText || ""} onChange={(e) => updateContent("buttonText", e.target.value)} />
          </div>
          <div>
            <label className="form-label">CTA Button Link URL</label>
            <input className="form-control form-control-sm" value={c.buttonLink || ""} onChange={(e) => updateContent("buttonLink", e.target.value)} />
          </div>
        </>
      );

    case "hero-split":
      return (
        <>
          <div>
            <label className="form-label">Badge Label Text</label>
            <input className="form-control form-control-sm" value={c.badgeText || ""} onChange={(e) => updateContent("badgeText", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Hero Title</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Hero Subtitle</label>
            <textarea className="form-control form-control-sm" rows={3} value={c.subtitle || ""} onChange={(e) => updateContent("subtitle", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Right Form Box Title</label>
            <input className="form-control form-control-sm" value={c.formTitle || ""} onChange={(e) => updateContent("formTitle", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Form Component Type</label>
            <select className="form-select form-select-sm" value={c.formType || "simple"} onChange={(e) => updateContent("formType", e.target.value)}>
              <option value="simple">Simple Lead Capture</option>
              <option value="enquiry_form">Embed Configured Enquiry Form</option>
            </select>
          </div>
          {c.formType === "enquiry_form" && (
            <div>
              <label className="form-label">Select Saved Enquiry Form</label>
              <select className="form-select form-select-sm" value={c.enquiryFormId || ""} onChange={(e) => updateContent("enquiryFormId", e.target.value)}>
                <option value="">-- Choose Enquiry Form --</option>
                {formsList.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">CTA Button Label</label>
            <input className="form-control form-control-sm" value={c.ctaText || ""} onChange={(e) => updateContent("ctaText", e.target.value)} />
          </div>
          <div>
            <label className="form-label">CTA Button Link URL</label>
            <input className="form-control form-control-sm" value={c.ctaLink || ""} onChange={(e) => updateContent("ctaLink", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Background Image URL</label>
            <input className="form-control form-control-sm" value={c.bgImage || ""} onChange={(e) => updateContent("bgImage", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Video Embed Link (For Style 4 Video Hero)</label>
            <input className="form-control form-control-sm" value={c.videoUrl || ""} onChange={(e) => updateContent("videoUrl", e.target.value)} />
          </div>
        </>
      );

    case "feature-showcase":
      return (
        <>
          <div>
            <label className="form-label">Showcase Section Title</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div className="border-top pt-2">
            <span className="form-label fw-bold d-block mb-2">Focus List Items</span>
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="p-2 border rounded bg-white mb-2">
                <div className="row g-2 mb-1">
                  <div className="col-4">
                    <input className="form-control form-control-sm text-center fw-bold" placeholder="01" value={item.num} onChange={(e) => {
                      const next = [...c.items];
                      next[idx] = { ...item, num: e.target.value };
                      updateContent("items", next);
                    }} />
                  </div>
                  <div className="col-8">
                    <input className="form-control form-control-sm fw-bold" placeholder="Item Heading" value={item.heading} onChange={(e) => {
                      const next = [...c.items];
                      next[idx] = { ...item, heading: e.target.value };
                      updateContent("items", next);
                    }} />
                  </div>
                </div>
                <textarea className="form-control form-control-sm" rows={2} placeholder="Item Detail Text" value={item.text} onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...item, text: e.target.value };
                  updateContent("items", next);
                }} />
              </div>
            ))}
          </div>
        </>
      );

    case "heading":
      return (
        <>
          <div>
            <label className="form-label">Heading Text Content</label>
            <textarea className="form-control form-control-sm" rows={3} value={c.text || ""} onChange={(e) => updateContent("text", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Font Family</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontFamily || "Inherit"} onChange={(e) => updateStyle("fontFamily", e.target.value)}>
              <option value="Inherit">Theme Default</option>
              <option value="Outfit">Outfit</option>
              <option value="Inter">Inter</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Lora">Lora</option>
            </select>
          </div>
          <div>
            <label className="form-label">Font Size</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontSize || "32px"} onChange={(e) => updateStyle("fontSize", e.target.value)}>
              <option value="20px">Small (20px)</option>
              <option value="24px">Medium (24px)</option>
              <option value="32px">Large (32px)</option>
              <option value="42px">X-Large (42px)</option>
              <option value="54px">XX-Large (54px)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Font Weight</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontWeight || "700"} onChange={(e) => updateStyle("fontWeight", e.target.value)}>
              <option value="400">Regular (400)</option>
              <option value="600">Semi Bold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="900">Black (900)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Font Style</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontStyle || "normal"} onChange={(e) => updateStyle("fontStyle", e.target.value)}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>
          <div>
            <label className="form-label">Alignment</label>
            <select className="form-select form-select-sm" value={comp.styles?.textAlign || "left"} onChange={(e) => updateStyle("textAlign", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );

    case "paragraph":
      return (
        <>
          <div>
            <label className="form-label">Paragraph Text Content</label>
            <textarea className="form-control form-control-sm" rows={5} value={c.text || ""} onChange={(e) => updateContent("text", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Font Size</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontSize || "16px"} onChange={(e) => updateStyle("fontSize", e.target.value)}>
              <option value="12px">12px</option>
              <option value="14px">14px</option>
              <option value="16px">16px</option>
              <option value="18px">18px</option>
              <option value="20px">20px</option>
            </select>
          </div>
          <div>
            <label className="form-label">Font Weight</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontWeight || "400"} onChange={(e) => updateStyle("fontWeight", e.target.value)}>
              <option value="300">Light (300)</option>
              <option value="400">Regular (400)</option>
              <option value="600">Medium (600)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Font Style</label>
            <select className="form-select form-select-sm" value={comp.styles?.fontStyle || "normal"} onChange={(e) => updateStyle("fontStyle", e.target.value)}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>
          <div>
            <label className="form-label">Alignment</label>
            <select className="form-select form-select-sm" value={comp.styles?.textAlign || "left"} onChange={(e) => updateStyle("textAlign", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justified</option>
            </select>
          </div>
        </>
      );

    case "logo":
      return (
        <>
          <div>
            <label className="form-label">Logo Image URL</label>
            <input className="form-control form-control-sm" value={c.logoUrl || ""} onChange={(e) => updateContent("logoUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Logo Width Size</label>
            <input className="form-control form-control-sm" value={c.logoWidth || ""} onChange={(e) => updateContent("logoWidth", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Logo Link Destination URL</label>
            <input className="form-control form-control-sm" value={c.linkUrl || ""} onChange={(e) => updateContent("linkUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Horizontal Alignment</label>
            <select className="form-select form-select-sm" value={c.align || "left"} onChange={(e) => updateContent("align", e.target.value)}>
              <option value="left">Left Align</option>
              <option value="center">Center Align</option>
              <option value="right">Right Align</option>
            </select>
          </div>
        </>
      );

    case "image":
      return (
        <>
          <div>
            <label className="form-label">Static Image URL</label>
            <input className="form-control form-control-sm" value={c.imageUrl || ""} onChange={(e) => updateContent("imageUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Image Alt Text</label>
            <input className="form-control form-control-sm" value={c.altText || ""} onChange={(e) => updateContent("altText", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Image Width</label>
            <input className="form-control form-control-sm" value={c.width || ""} onChange={(e) => updateContent("width", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Image Height</label>
            <input className="form-control form-control-sm" value={c.height || ""} onChange={(e) => updateContent("height", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Image Click Link URL</label>
            <input className="form-control form-control-sm" value={c.linkUrl || ""} onChange={(e) => updateContent("linkUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Alignment</label>
            <select className="form-select form-select-sm" value={c.align || "center"} onChange={(e) => updateContent("align", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );

    case "button":
      return (
        <>
          <div>
            <label className="form-label">Button Label Text</label>
            <input className="form-control form-control-sm" value={c.text || ""} onChange={(e) => updateContent("text", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Click Link Destination URL</label>
            <input className="form-control form-control-sm" value={c.linkUrl || ""} onChange={(e) => updateContent("linkUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Bootstrap Icon Name</label>
            <input className="form-control form-control-sm" value={c.iconClass || ""} onChange={(e) => updateContent("iconClass", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Button Color</label>
            <input type="color" className="form-control form-control-sm form-control-color w-100" value={c.btnColor || "#2249b7"} onChange={(e) => updateContent("btnColor", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Text Color</label>
            <input type="color" className="form-control form-control-sm form-control-color w-100" value={c.textColor || "#ffffff"} onChange={(e) => updateContent("textColor", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Button Width Mode</label>
            <select className="form-select form-select-sm" value={c.width || "auto"} onChange={(e) => updateContent("width", e.target.value)}>
              <option value="auto">Auto Width</option>
              <option value="100%">Full Width (100%)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Horizontal Alignment</label>
            <select className="form-select form-select-sm" value={c.align || "left"} onChange={(e) => updateContent("align", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );

    case "divider":
      return (
        <>
          <div>
            <label className="form-label">Line Color</label>
            <input type="color" className="form-control form-control-sm form-control-color w-100" value={c.color || "#cbd5e1"} onChange={(e) => updateContent("color", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Thickness Size</label>
            <input className="form-control form-control-sm" value={c.thickness || ""} onChange={(e) => updateContent("thickness", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Horizontal Width</label>
            <input className="form-control form-control-sm" value={c.width || ""} onChange={(e) => updateContent("width", e.target.value)} />
          </div>
        </>
      );

    case "spacer":
      return (
        <div>
          <label className="form-label">Spacer Vertical Height Size</label>
          <input className="form-control form-control-sm" value={c.height || ""} onChange={(e) => updateContent("height", e.target.value)} />
        </div>
      );

    case "icon":
      return (
        <>
          <div>
            <label className="form-label">Bootstrap Icon Class</label>
            <input className="form-control form-control-sm" value={c.iconClass || ""} onChange={(e) => updateContent("iconClass", e.target.value)} />
            <a href="https://icons.getbootstrap.com/" target="_blank" rel="noopener noreferrer" className="small text-wa">Browse Bootstrap Icons</a>
          </div>
          <div>
            <label className="form-label">Icon Color</label>
            <input type="color" className="form-control form-control-sm form-control-color w-100" value={c.color || "#2249b7"} onChange={(e) => updateContent("color", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Icon Size</label>
            <input className="form-control form-control-sm" value={c.size || ""} onChange={(e) => updateContent("size", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Link Destination URL</label>
            <input className="form-control form-control-sm" value={c.linkUrl || ""} onChange={(e) => updateContent("linkUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Alignment</label>
            <select className="form-select form-select-sm" value={c.align || "left"} onChange={(e) => updateContent("align", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );

    case "social-icons":
      return (
        <>
          <div>
            <label className="form-label">Facebook Profile Link</label>
            <input className="form-control form-control-sm" value={c.facebook || ""} onChange={(e) => updateContent("facebook", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Instagram Profile Link</label>
            <input className="form-control form-control-sm" value={c.instagram || ""} onChange={(e) => updateContent("instagram", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Linkedin Profile Link</label>
            <input className="form-control form-control-sm" value={c.linkedin || ""} onChange={(e) => updateContent("linkedin", e.target.value)} />
          </div>
          <div>
            <label className="form-label">WhatsApp Click Link</label>
            <input className="form-control form-control-sm" value={c.whatsapp || ""} onChange={(e) => updateContent("whatsapp", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Twitter Profile Link</label>
            <input className="form-control form-control-sm" value={c.twitter || ""} onChange={(e) => updateContent("twitter", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Icon Color Theme</label>
            <input type="color" className="form-control form-control-sm form-control-color w-100" value={c.iconColor || "#475569"} onChange={(e) => updateContent("iconColor", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Icon Size</label>
            <input className="form-control form-control-sm" value={c.iconSize || ""} onChange={(e) => updateContent("iconSize", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Alignment</label>
            <select className="form-select form-select-sm" value={c.align || "center"} onChange={(e) => updateContent("align", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );

    case "form-container":
      return (
        <>
          <div>
            <label className="form-label">Form Title</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Description text</label>
            <textarea className="form-control form-control-sm" rows={2} value={c.subtitle || ""} onChange={(e) => updateContent("subtitle", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Form Type Mode</label>
            <select className="form-select form-select-sm" value={c.formType || "simple"} onChange={(e) => updateContent("formType", e.target.value)}>
              <option value="simple">Simple Lead Capture Form</option>
              <option value="enquiry_form">Embed Saved Enquiry Form</option>
            </select>
          </div>
          {c.formType === "enquiry_form" && (
            <div>
              <label className="form-label">Choose Saved Enquiry Form</label>
              <select className="form-select form-select-sm" value={c.enquiryFormId || ""} onChange={(e) => updateContent("enquiryFormId", e.target.value)}>
                <option value="">-- Choose Enquiry Form --</option>
                {formsList.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Submit Button Label</label>
            <input className="form-control form-control-sm" value={c.submitButtonText || ""} onChange={(e) => updateContent("submitButtonText", e.target.value)} />
          </div>
        </>
      );

    case "payment-form":
      return (
        <>
          <div>
            <label className="form-label">Checkout Header Title</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Header Subtitle</label>
            <input className="form-control form-control-sm" value={c.subtitle || ""} onChange={(e) => updateContent("subtitle", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Item / Product Name</label>
            <input className="form-control form-control-sm" value={c.itemName || ""} onChange={(e) => updateContent("itemName", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Price Amount (e.g. $250.00)</label>
            <input className="form-control form-control-sm" value={c.priceText || ""} onChange={(e) => updateContent("priceText", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Secure Checkout Button Text</label>
            <input className="form-control form-control-sm" value={c.buttonText || ""} onChange={(e) => updateContent("buttonText", e.target.value)} />
          </div>
        </>
      );

    case "iframe":
      return (
        <>
          <div>
            <label className="form-label">Iframe Embed Target URL</label>
            <input className="form-control form-control-sm" value={c.iframeUrl || ""} onChange={(e) => updateContent("iframeUrl", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Iframe height</label>
            <input className="form-control form-control-sm" value={c.height || ""} onChange={(e) => updateContent("height", e.target.value)} />
          </div>
        </>
      );

    case "features":
      return (
        <>
          <div>
            <label className="form-label">Features Title</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div className="border-top pt-2">
            <span className="form-label fw-bold d-block mb-1">Feature Grid items</span>
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="p-2 border rounded bg-white mb-2">
                <input className="form-control form-control-sm fw-bold mb-1" placeholder="Title" value={item.title} onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...item, title: e.target.value };
                  updateContent("items", next);
                }} />
                <textarea className="form-control form-control-sm" rows={2} placeholder="Description" value={item.desc} onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...item, desc: e.target.value };
                  updateContent("items", next);
                }} />
              </div>
            ))}
          </div>
        </>
      );

    case "faq":
      return (
        <>
          <div>
            <label className="form-label">Accordion Heading</label>
            <input className="form-control form-control-sm" value={c.title || ""} onChange={(e) => updateContent("title", e.target.value)} />
          </div>
          <div className="border-top pt-2">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="p-2 border rounded bg-white mb-2">
                <input className="form-control form-control-sm fw-bold mb-1" placeholder="Question" value={item.q} onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...item, q: e.target.value };
                  updateContent("items", next);
                }} />
                <textarea className="form-control form-control-sm" rows={2} placeholder="Answer" value={item.a} onChange={(e) => {
                  const next = [...c.items];
                  next[idx] = { ...item, a: e.target.value };
                  updateContent("items", next);
                }} />
              </div>
            ))}
          </div>
        </>
      );

    case "footer":
      return (
        <>
          <div>
            <label className="form-label">Address</label>
            <input className="form-control form-control-sm" value={c.address || ""} onChange={(e) => updateContent("address", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Phone Support</label>
            <input className="form-control form-control-sm" value={c.phone || ""} onChange={(e) => updateContent("phone", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email Support</label>
            <input className="form-control form-control-sm" value={c.email || ""} onChange={(e) => updateContent("email", e.target.value)} />
          </div>
          <div>
            <label className="form-label">Copyright Text</label>
            <input className="form-control form-control-sm" value={c.copyright || ""} onChange={(e) => updateContent("copyright", e.target.value)} />
          </div>
        </>
      );

    default: {
      const keys = Object.keys(c);
      if (keys.length === 0) return <span className="small text-muted">This component has no content properties. Use style or layout tabs to customize.</span>;
      return (
        <>
           {keys.map((key) => {
            if (key === "presetType") return null;
            const val = c[key];
            if (key === "fieldName") {
              const standardFields = [
                { val: "name", label: "Student/Parent Name (name)" },
                { val: "email", label: "Email Address (email)" },
                { val: "mobile", label: "Mobile Number (mobile)" },
                { val: "class", label: "Applying Class (class)" },
                { val: "remarks", label: "Enquiry Remarks (remarks)" },
                { val: "source", label: "Enquiry Source (source)" },
              ];
              const isStandard = standardFields.some(f => f.val === val);
              return (
                <div key={key} className="mb-2">
                  <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: "10.5px" }}>CRM Field Mapping</label>
                  <select
                    className="form-select form-select-sm mb-1"
                    value={isStandard ? val : "custom"}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      if (nextVal !== "custom") {
                        updateContent("fieldName", nextVal);
                      }
                    }}
                  >
                    {standardFields.map((f) => (
                      <option key={f.val} value={f.val}>{f.label}</option>
                    ))}
                    <option value="custom">Custom Field Name...</option>
                  </select>
                  {!isStandard && (
                    <input
                      type="text"
                      className="form-control form-control-sm mt-1"
                      placeholder="Enter custom CRM database field key..."
                      value={val || ""}
                      onChange={(e) => updateContent("fieldName", e.target.value)}
                    />
                  )}
                </div>
              );
            }
            const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
            if (Array.isArray(val)) {
              return (
                <div key={key}>
                  <label className="form-label">{label} (comma-separated)</label>
                  <input
                    className="form-control form-control-sm"
                    value={val.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(", ")}
                    onChange={(e) => updateContent(key, e.target.value.split(",").map(s => s.trim()))}
                  />
                </div>
              );
            }
            if (typeof val === "boolean") {
              return (
                <div key={key} className="form-check form-switch mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={val}
                    onChange={(e) => updateContent(key, e.target.checked)}
                  />
                  <label className="form-check-label small">{label}</label>
                </div>
              );
            }
            if (typeof val === "number") {
              return (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={val}
                    onChange={(e) => updateContent(key, Number(e.target.value))}
                  />
                </div>
              );
            }
            return (
              <div key={key}>
                <label className="form-label">{label}</label>
                <input
                  className="form-control form-control-sm"
                  value={val || ""}
                  onChange={(e) => updateContent(key, e.target.value)}
                />
              </div>
            );
          })}
        </>
      );
    }
  }
}

// Helpers
function updateTheme(key, value) {
  // handled inside component state mutator if needed
}

function renderNewComponentLive(comp, theme, formsList, formValues, setFormValues) {
  const c = comp.content || {};
  const s = comp.styles || {};
  
  const textStyle = {
    fontSize: s.fontSize || "inherit",
    fontWeight: s.fontWeight || "inherit",
    fontStyle: s.fontStyle || "normal",
    color: s.textColor || "inherit",
    textAlign: s.textAlign || "left"
  };

  switch (comp.type) {
    // PRESETS
    case "about-us-preset":
      return (
        <div className="container py-4 text-start">
          <div className="row align-items-center g-4">
            <div className="col-md-7">
              <h3 className="fw-bold text-dark">{c.title || "About Us"}</h3>
              <p className="text-muted leading-relaxed">{c.subtitle}</p>
              {c.ctaText && <a href={c.ctaLink} className="btn btn-sm text-white px-3 py-1.5" style={{ backgroundColor: theme.primaryColor }}>{c.ctaText}</a>}
            </div>
            {c.image && (
              <div className="col-md-5">
                <img src={c.image} alt="About Us" className="img-fluid rounded-3 shadow-sm" />
              </div>
            )}
          </div>
        </div>
      );
    case "contact-preset":
      return (
        <div className="container py-4 text-start">
          <h4 className="fw-bold mb-3">{c.title || "Contact Us"}</h4>
          <div className="row g-3">
            <div className="col-sm-4">
              <div className="p-3 border rounded-3 bg-white h-100">
                <i className="bi bi-envelope-fill text-wa fs-4 mb-2"></i>
                <h6 className="fw-bold">Email Us</h6>
                <span className="small text-muted text-break">{c.email}</span>
              </div>
            </div>
            <div className="col-sm-4">
              <div className="p-3 border rounded-3 bg-white h-100">
                <i className="bi bi-telephone-fill text-wa fs-4 mb-2"></i>
                <h6 className="fw-bold">Call Us</h6>
                <span className="small text-muted">{c.phone}</span>
              </div>
            </div>
            <div className="col-sm-4">
              <div className="p-3 border rounded-3 bg-white h-100">
                <i className="bi bi-clock-fill text-wa fs-4 mb-2"></i>
                <h6 className="fw-bold">Working Hours</h6>
                <span className="small text-muted">{c.hours}</span>
              </div>
            </div>
          </div>
        </div>
      );
    case "team-preset":
      return (
        <div className="container py-4 text-start">
          <h4 className="fw-bold text-center mb-4">{c.title || "Meet Our Team"}</h4>
          <div className="row g-3 justify-content-center">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="col-6 col-sm-4 text-center">
                <img src={item.photo} alt={item.name} className="rounded-circle mb-2 shadow-sm" style={{ width: "90px", height: "90px", objectFit: "cover" }} />
                <h6 className="fw-bold mb-0 text-dark">{item.name}</h6>
                <span className="small text-muted">{item.role}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "clients-preset":
      return (
        <div className="container py-3 text-center">
          {c.title && <h6 className="text-secondary text-uppercase fw-bold mb-3 small" style={{ letterSpacing: "1px" }}>{c.title}</h6>}
          <div className="d-flex justify-content-center align-items-center gap-4 flex-wrap">
            {(c.logos || []).map((logo, idx) => (
              <img key={idx} src={logo} alt="Partner Logo" className="img-fluid" style={{ maxHeight: "35px", opacity: 0.6 }} />
            ))}
          </div>
        </div>
      );
    case "stats-preset":
      return (
        <div className="container py-4 text-center">
          {c.title && <h4 className="fw-bold mb-4">{c.title}</h4>}
          <div className="row g-3">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="col">
                <h2 className="fw-bold mb-1 text-wa">{item.val}</h2>
                <span className="small text-secondary fw-semibold text-uppercase">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "workflow-preset":
      return (
        <div className="container py-4 text-start">
          <h4 className="fw-bold mb-4 text-center">{c.title}</h4>
          <div className="row g-3 justify-content-center">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="col-md-4 text-center">
                <div className="p-3 border rounded-3 bg-white shadow-sm h-100">
                  <span className="badge bg-primary-soft text-wa mb-2 fw-bold">{item.step}</span>
                  <h6 className="fw-bold text-dark">{item.title}</h6>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "careers-preset":
      return (
        <div className="container py-4 text-start">
          <h4 className="fw-bold mb-4">{c.title || "Careers"}</h4>
          <div className="d-flex flex-column gap-2">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="p-3 border rounded-3 bg-white d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="fw-bold text-dark mb-0">{item.title}</h6>
                  <span className="small text-muted">{item.loc}</span>
                </div>
                <span className="badge bg-wa-soft text-wa">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "portfolio-preset":
      return (
        <div className="container py-4 text-start">
          <h4 className="fw-bold mb-4 text-center">{c.title || "Gallery Portfolio"}</h4>
          <div className="row g-2">
            {(c.items || []).map((img, idx) => (
              <div key={idx} className="col-6 col-sm-4">
                <img src={img} alt="Portfolio Facility" className="img-fluid rounded shadow-sm" style={{ height: "150px", width: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>
      );

    // BASIC
    case "label":
      return <span style={textStyle} className="badge bg-danger">{c.text}</span>;
    case "quote":
      return (
        <blockquote style={textStyle} className="border-start border-3 ps-3 italic text-muted">
          "{c.text}"
          {c.author && <cite className="d-block small text-muted font-normal mt-1">— {c.author}</cite>}
        </blockquote>
      );
    case "badge":
      return <span style={textStyle} className="badge bg-warning text-dark px-2.5 py-1 fw-bold">{c.text}</span>;
    case "bullet-list":
      return (
        <ul style={textStyle} className="list-unstyled mb-0 d-flex flex-column gap-1">
          {(c.items || []).map((item, i) => (
            <li key={i}><i className="bi bi-circle-fill me-2 fs-xs" style={{ fontSize: "8px" }}></i>{item}</li>
          ))}
        </ul>
      );
    case "alert-bar":
      return (
        <div className="alert p-3 border-0 m-0" style={{ backgroundColor: s.backgroundColor || "#fef3c7", color: s.textColor || "#d97706" }}>
          <i className="bi bi-info-circle-fill me-2"></i>{c.text}
        </div>
      );
    case "icon-list":
      return (
        <ul style={textStyle} className="list-unstyled mb-0 d-flex flex-column gap-2">
          {(c.items || []).map((item, i) => (
            <li key={i} className="d-flex align-items-center gap-2"><i className="bi bi-check-circle-fill text-success fs-5"></i> {item}</li>
          ))}
        </ul>
      );
    case "text-link":
      return <a href={c.url || "#"} style={textStyle} className="text-decoration-underline text-wa">{c.text}</a>;
    case "title-group":
      return (
        <div style={textStyle}>
          <h4 className="fw-bold mb-1">{c.title}</h4>
          <span className="small text-muted">{c.subtitle}</span>
        </div>
      );

    // FORM FIELDS
    case "text-input":
    case "number-input":
    case "email-input":
    case "phone-input":
    case "password-input": {
      const typeMap = { "number-input": "number", "email-input": "email", "phone-input": "tel", "password-input": "password" };
      const t = typeMap[comp.type] || "text";
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <input type={t} className="form-control form-control-sm" placeholder={c.placeholder} disabled />
        </div>
      );
    }
    case "textarea-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <textarea className="form-control form-control-sm" rows={2} placeholder={c.placeholder} disabled />
        </div>
      );
    case "otp-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark mb-2">{c.label}</label>
          <div className="d-flex gap-2">
            {Array.from({ length: c.digits || 6 }).map((_, idx) => (
              <input key={idx} type="text" className="form-control form-control-sm text-center fw-bold" style={{ width: "35px" }} placeholder="•" disabled />
            ))}
          </div>
        </div>
      );
    case "date-input":
    case "time-input":
    case "datetime-input": {
      const t = comp.type === "date-input" ? "date" : comp.type === "time-input" ? "time" : "datetime-local";
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <input type={t} className="form-control form-control-sm" disabled />
        </div>
      );
    }
    case "dropdown-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <select className="form-select form-select-sm" disabled>
            {(c.options || "").split(",").map((o, idx) => (
              <option key={idx}>{o.trim()}</option>
            ))}
          </select>
        </div>
      );
    case "multiselect-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <div className="border p-2 rounded bg-light d-flex gap-1 flex-wrap" style={{ minHeight: "38px" }}>
            {(c.options || "").split(",").slice(0, 3).map((o, idx) => (
              <span key={idx} className="badge bg-secondary d-flex align-items-center gap-1">{o.trim()} <i className="bi bi-x small"></i></span>
            ))}
            <span className="small text-muted ms-auto">Choose tags...</span>
          </div>
        </div>
      );
    case "radio-group-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark d-block">{c.label}</label>
          <div className="d-flex gap-3 flex-wrap">
            {(c.options || "").split(",").map((o, idx) => (
              <div key={idx} className="form-check">
                <input className="form-check-input" type="radio" disabled />
                <label className="form-check-label small">{o.trim()}</label>
              </div>
            ))}
          </div>
        </div>
      );
    case "checkbox-input":
      return (
        <div className="w-100 text-start form-check">
          <input className="form-check-input" type="checkbox" checked={c.required} disabled />
          <label className="form-check-label small fw-semibold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
        </div>
      );
    case "switch-input":
      return (
        <div className="w-100 text-start form-check form-switch">
          <input className="form-check-input" type="checkbox" disabled />
          <label className="form-check-label small fw-semibold text-dark">{c.label}</label>
        </div>
      );
    case "slider-input":
      return (
        <div className="w-100 text-start">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-dark mb-0">{c.label}</label>
            <span className="small text-muted">{c.min || 0} - {c.max || 100}</span>
          </div>
          <input type="range" className="form-range" min={c.min} max={c.max} disabled />
        </div>
      );
    case "rating-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark d-block">{c.label}</label>
          <div className="d-flex gap-1 text-warning fs-5">
            {Array.from({ length: c.maxStars || 5 }).map((_, idx) => (
              <i key={idx} className="bi bi-star"></i>
            ))}
          </div>
        </div>
      );
    case "upload-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label}</label>
          <div className="border border-dashed rounded-3 p-3 bg-light text-center cursor-pointer">
            <i className="bi bi-cloud-arrow-up text-muted fs-3 d-block mb-1"></i>
            <span className="small text-muted">Upload file ({c.accept})</span>
          </div>
        </div>
      );
    case "location-input":
      return (
        <div className="w-100 text-start">
          <label className="form-label small fw-bold text-dark">{c.label}</label>
          <div className="p-3 border rounded-3 bg-light text-center d-flex align-items-center justify-content-center gap-2 text-muted">
            <i className="bi bi-geo-alt-fill text-danger fs-5 animate-bounce"></i>
            <span className="small fw-semibold">Interactive Map Pin Selector</span>
          </div>
        </div>
      );

    // LAYOUT BOXES
    case "layout-section":
    case "layout-container":
    case "layout-row":
    case "layout-column":
    case "layout-card":
    case "layout-grid":
    case "layout-split":
    case "layout-flex":
    case "layout-sidebar-left":
    case "layout-sidebar-right":
    case "layout-center":
    case "layout-3col":
    case "layout-4col":
    case "layout-scroll-x":
      return (
        <div className="w-100 p-4 border border-dashed text-center rounded-3 bg-light text-muted" style={{ minHeight: "100px" }}>
          <i className="bi bi-box fs-3 d-block mb-1 text-wa" style={{ opacity: 0.6 }}></i>
          <span className="small fw-bold text-uppercase d-block" style={{ fontSize: "9px" }}>{comp.type.replace("layout-", "").replace("-", " ")} Container</span>
          <span className="text-secondary" style={{ fontSize: "10px" }}>Drag child elements inside this box in the final layout flow.</span>
        </div>
      );
    case "layout-accordion":
      return (
        <div className="w-100 d-flex flex-column gap-2 text-start">
          {(c.items || "").split(",").map((item, idx) => (
            <div key={idx} className="p-2.5 border rounded-3 bg-white d-flex justify-content-between align-items-center">
              <span className="small fw-bold text-dark">{item.trim()}</span>
              <i className="bi bi-chevron-down text-muted"></i>
            </div>
          ))}
        </div>
      );
    case "layout-tabs":
      return (
        <div className="w-100 text-start">
          <div className="d-flex border-bottom overflow-x-auto">
            {(c.items || "").split(",").map((item, idx) => (
              <span key={idx} className={`pb-2 px-3 small fw-bold ${idx === 0 ? "border-bottom border-2 border-primary text-primary" : "text-muted"}`} style={{ borderBottomColor: theme.primaryColor }}>
                {item.trim()}
              </span>
            ))}
          </div>
        </div>
      );

    // MEDIA
    case "media-video":
      return (
        <div className="w-100 bg-dark text-white d-flex align-items-center justify-content-center rounded-3 overflow-hidden position-relative" style={{ height: "200px" }}>
          <i className="bi bi-play-circle-fill display-3 text-white position-absolute z-1 opacity-75"></i>
          <span className="small text-white position-absolute bottom-0 start-0 p-2 bg-black bg-opacity-50 w-100 text-start">{c.videoUrl}</span>
        </div>
      );
    case "media-gallery":
      return (
        <div className="w-100 py-2">
          <div className="row g-2">
            {(c.images || []).map((img, i) => (
              <div key={i} className="col">
                <img src={img} alt="Gallery item" className="img-fluid rounded" style={{ height: "80px", width: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>
      );
    case "media-lottie":
      return (
        <div className="p-4 border rounded text-center bg-white text-muted">
          <i className="bi bi-magic text-wa display-6 mb-2 d-block"></i>
          <span className="small">Lottie JSON Animation Player</span>
        </div>
      );
    case "media-audio":
      return (
        <div className="p-3 border rounded-3 bg-light d-flex align-items-center gap-3 text-start w-100">
          <button className="btn btn-sm btn-primary rounded-circle px-2.5 py-1.5"><i className="bi bi-play-fill text-white"></i></button>
          <div>
            <h6 className="fw-bold mb-0 text-dark small">{c.title || "Voice Memo Audio"}</h6>
            <span className="small text-muted" style={{ fontSize: "10px" }}>0:00 / 3:45</span>
          </div>
        </div>
      );
    case "media-pdf":
      return (
        <div className="w-100 bg-secondary-soft p-5 border rounded text-center d-flex align-items-center justify-content-center text-muted" style={{ height: "180px" }}>
          <div>
            <i className="bi bi-file-earmark-pdf-fill text-danger fs-1 mb-2 d-block"></i>
            <span className="small fw-semibold d-block">PDF Attachment Viewer</span>
            <span className="small text-muted" style={{ fontSize: "10px" }}>{c.pdfUrl}</span>
          </div>
        </div>
      );
    case "media-svg":
      return <div className="d-inline-block border p-2 rounded" dangerouslySetInnerHTML={{ __html: c.svgCode || "" }} />;
    case "media-comparison":
      return (
        <div className="w-100 position-relative rounded overflow-hidden shadow-sm" style={{ height: "200px" }}>
          <img src={c.beforeImg} alt="Before" className="position-absolute w-100 h-100" style={{ objectFit: "cover" }} />
          <div className="position-absolute h-100 top-0 end-0 border-start border-3 border-white" style={{ width: "50%", overflow: "hidden" }}>
            <img src={c.afterImg} alt="After" className="position-absolute" style={{ width: "200%", height: "100%", objectFit: "cover", right: 0 }} />
          </div>
          <span className="badge bg-dark position-absolute bottom-0 start-0 m-2">{c.labelBefore}</span>
          <span className="badge bg-primary position-absolute bottom-0 end-0 m-2">{c.labelAfter}</span>
        </div>
      );
    case "media-progress-circle": {
      const radius = 35;
      const circ = 2 * Math.PI * radius;
      const offset = circ - ((c.percentage || 0) / 100) * circ;
      return (
        <div className="text-center d-inline-flex flex-column align-items-center">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle cx="45" cy="45" r={radius} fill="none" stroke={theme.primaryColor} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 45 45)" />
            <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fw-bold text-dark" style={{ fontSize: "14px" }}>{c.percentage}%</text>
          </svg>
          <span className="small fw-semibold mt-1 text-dark">{c.label}</span>
        </div>
      );
    }
    case "media-voice":
      return (
        <div className="p-3 border rounded text-center bg-white text-muted">
          <i className="bi bi-mic-fill text-danger fs-3 mb-2 d-block"></i>
          <span className="small">{c.prompt || "Start Voice Recorder Input"}</span>
        </div>
      );
    case "media-hotspots":
      return (
        <div className="w-100 position-relative rounded overflow-hidden" style={{ height: "200px" }}>
          <img src={c.image} alt="Hotspots Background" className="w-100 h-100" style={{ objectFit: "cover" }} />
          {(c.hotspots || []).map((h, i) => (
            <span key={i} className="position-absolute bg-danger text-white rounded-circle d-flex align-items-center justify-content-center shadow-lg cursor-pointer" style={{ left: h.x, top: h.y, width: "16px", height: "16px" }} title={h.tooltip}>
              <span className="bg-white rounded-circle" style={{ width: "6px", height: "6px" }}></span>
            </span>
          ))}
        </div>
      );
    case "media-youtube":
    case "media-vimeo":
      return (
        <div className="w-100 bg-secondary-soft p-5 border rounded text-center d-flex align-items-center justify-content-center text-muted" style={{ height: "180px" }}>
          <div>
            <i className={`bi bi-${comp.type === "media-youtube" ? "youtube text-danger" : "vimeo text-info"} fs-1 mb-2 d-block`}></i>
            <span className="small fw-semibold d-block">External Video Frame Embed</span>
            <span className="small text-muted" style={{ fontSize: "10px" }}>Video ID: {c.videoId}</span>
          </div>
        </div>
      );
    case "media-gmaps":
      return (
        <div className="w-100 bg-light p-4 rounded text-center border d-flex align-items-center justify-content-center text-muted" style={{ height: "150px" }}>
          <div>
            <i className="bi bi-map-fill text-success fs-2 mb-1 d-block"></i>
            <span className="small fw-semibold d-block">Google Maps View Map</span>
            <span className="small text-muted" style={{ fontSize: "9px" }}>{c.address}</span>
          </div>
        </div>
      );
    case "media-html5-video":
      return (
        <div className="w-100 bg-black text-white d-flex align-items-center justify-content-center rounded" style={{ height: "180px" }}>
          <i className="bi bi-film fs-1"></i>
        </div>
      );
    case "media-icon-array":
      return (
        <div className="w-100 d-flex justify-content-center gap-3 flex-wrap">
          {(c.icons || []).map((icon, i) => (
            <div key={i} className="p-2 bg-light border rounded"><i className={`bi ${icon} fs-4 text-wa`}></i></div>
          ))}
        </div>
      );
    case "media-slideshow":
      return (
        <div className="w-100 position-relative rounded overflow-hidden bg-light d-flex align-items-center justify-content-center" style={{ height: "200px" }}>
          {c.images && c.images.length > 0 ? (
            <img src={c.images[0]} alt="Slideshow Preview" className="w-100 h-100" style={{ objectFit: "cover" }} />
          ) : (
            <i className="bi bi-images fs-1 text-muted"></i>
          )}
          <span className="position-absolute bottom-0 start-50 -translate-x-50 p-2 text-white small bg-black bg-opacity-50">Auto Photos Slideshow</span>
        </div>
      );

    // INTERACTIVE
    case "interactive-whatsapp":
      return (
        <a href="#" className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold" style={{ backgroundColor: "#25D366", borderRadius: "30px", padding: "8px 16px" }}>
          <i className="bi bi-whatsapp"></i> {c.label || "WhatsApp Chat"}
        </a>
      );
    case "interactive-fab":
      return (
        <button className="btn rounded-circle d-flex align-items-center justify-content-center shadow-lg" style={{ backgroundColor: theme.primaryColor, color: "#ffffff", width: "50px", height: "50px" }} title={c.label}>
          <i className={`bi ${c.iconClass || "bi-chat-dots-fill"} fs-4 text-white`}></i>
        </button>
      );
    case "interactive-cta":
      return (
        <button className="btn w-100 text-white fw-bold py-3 text-uppercase shadow-sm" style={{ backgroundColor: "#e11d48", borderRadius: theme.borderRadius }}>
          <i className="bi bi-lightning-charge-fill me-2"></i>{c.text}
        </button>
      );
    case "interactive-top":
      return <button className="btn btn-sm btn-dark text-white rounded-3"><i className="bi bi-arrow-up-short me-1"></i>{c.label}</button>;
    case "interactive-copy":
      return (
        <div className="d-flex align-items-center gap-2 p-2 border rounded bg-light w-100">
          <span className="small fw-mono text-secondary">{c.textToCopy}</span>
          <button className="btn btn-xs btn-outline-secondary ms-auto py-1 px-2.5" style={{ fontSize: "10px" }}><i className="bi bi-clipboard me-1"></i>Copy</button>
        </div>
      );
    case "interactive-share":
      return <button className="btn btn-sm btn-primary"><i className="bi bi-share me-1"></i>Share Page</button>;
    case "interactive-theme":
      return <button className="btn btn-sm btn-outline-secondary"><i className="bi bi-brightness-high me-1"></i>Toggle Theme</button>;
    case "interactive-mic":
      return <button className="btn btn-danger btn-sm"><i className="bi bi-mic me-1"></i>{c.label}</button>;
    case "interactive-call":
      return <button className="btn btn-sm btn-success"><i className="bi bi-telephone-outbound me-1"></i>{c.text}</button>;
    case "interactive-email":
      return <button className="btn btn-sm btn-secondary"><i className="bi bi-envelope-at me-1"></i>{c.text}</button>;
    case "interactive-js":
      return <button className="btn btn-sm btn-warning text-dark fw-semibold"><i className="bi bi-braces me-1"></i>{c.label}</button>;
    case "interactive-search":
      return (
        <div className="input-group">
          <input type="text" className="form-control form-control-sm" placeholder={c.placeholder} />
          <button className="btn btn-sm btn-outline-secondary"><i className="bi bi-search"></i></button>
        </div>
      );
    case "interactive-pin":
      return <span className="small text-danger fw-semibold cursor-pointer"><i className="bi bi-pin-angle-fill me-1"></i>{c.label}</span>;
    case "interactive-download":
      return <button className="btn btn-sm btn-info text-white"><i className="bi bi-download me-1"></i>{c.label}</button>;
    case "interactive-modal":
      return <button className="btn btn-sm btn-primary"><i className="bi bi-window me-1"></i>{c.buttonText}</button>;

    // ADVANCED
    case "advanced-counter":
      return (
        <div className="text-center p-3">
          <h2 className="fw-bold mb-0 text-dark">{c.targetNumber}{c.suffix}</h2>
          <span className="small text-muted">{c.title}</span>
        </div>
      );
    case "advanced-progress":
      return (
        <div className="w-100 text-start">
          <div className="d-flex justify-content-between small fw-bold mb-1">
            <span>{c.label}</span>
            <span>{c.percent}%</span>
          </div>
          <div className="progress" style={{ height: "8px" }}>
            <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style={{ width: `${c.percent}%`, backgroundColor: theme.primaryColor }}></div>
          </div>
        </div>
      );
    case "advanced-countdown":
      return (
        <div className="p-3 rounded border bg-light text-center w-100">
          <span className="small text-muted fw-bold text-uppercase d-block mb-2">{c.label}</span>
          <div className="d-flex justify-content-center gap-3">
            <div className="px-3 py-1 bg-white border rounded"><span className="fw-bold fs-5">02</span><small className="d-block text-muted" style={{ fontSize: "8px" }}>Days</small></div>
            <div className="px-3 py-1 bg-white border rounded"><span className="fw-bold fs-5">14</span><small className="d-block text-muted" style={{ fontSize: "8px" }}>Hours</small></div>
            <div className="px-3 py-1 bg-white border rounded"><span className="fw-bold fs-5">35</span><small className="d-block text-muted" style={{ fontSize: "8px" }}>Mins</small></div>
          </div>
        </div>
      );
    case "advanced-map":
      return (
        <div className="w-100 bg-light p-4 rounded border text-center text-muted" style={{ height: "150px" }}>
          <i className="bi bi-map-fill text-wa fs-2 mb-1 d-block"></i>
          <span className="small fw-semibold d-block">Leaflet OpenStreetMap Frame</span>
        </div>
      );
    case "advanced-html":
      return <div dangerouslySetInnerHTML={{ __html: c.htmlCode || "" }} />;
    case "advanced-timeline":
      return (
        <div className="w-100 text-start py-2">
          {(c.steps || []).map((step, idx) => (
            <div key={idx} className="d-flex gap-3 mb-3 align-items-start">
              <span className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: "24px", height: "24px", minWidth: "24px", backgroundColor: theme.primaryColor }}>{idx + 1}</span>
              <span className="small fw-bold text-dark pt-1">{step}</span>
            </div>
          ))}
        </div>
      );
    case "advanced-pie-chart":
    case "advanced-bar-chart":
    case "advanced-line-graph": {
      const colorMap = { "advanced-pie-chart": "#ef4444", "advanced-bar-chart": "#3b82f6", "advanced-line-graph": "#10b981" };
      const color = colorMap[comp.type];
      return (
        <div className="p-3 border rounded bg-white text-center w-100">
          <h6 className="fw-bold text-dark mb-2 text-start small">{c.title || "Data Analytics Metrics"}</h6>
          <div className="d-flex align-items-center justify-content-center py-3 bg-light rounded" style={{ height: "100px" }}>
            <i className={`bi bi-${comp.type === "advanced-pie-chart" ? "pie-chart" : comp.type === "advanced-bar-chart" ? "graph-up" : "activity"} fs-1`} style={{ color }}></i>
          </div>
          <span className="small text-muted d-block mt-2" style={{ fontSize: "9px" }}>{c.data || c.values}</span>
        </div>
      );
    }

    default:
      return <span className="small text-muted">{comp.type} element mockup preview</span>;
  }
}

// Wrapper to handle inline image editing popup state smoothly
function EditableImageWrapper({ comp, field, imgUrl, className, style, pushState, page }) {
  const [showPopup, setShowPopup] = useState(false);
  const [tempUrl, setTempUrl] = useState(imgUrl);
  const redirectField = field + "Link";
  const [tempRedirect, setTempRedirect] = useState(comp.content?.[redirectField] || "");

  // Sync state if imgUrl changes from parent settings panel
  useEffect(() => {
    setTempUrl(imgUrl);
  }, [imgUrl]);

  useEffect(() => {
    setTempRedirect(comp.content?.[redirectField] || "");
  }, [comp.content?.[redirectField], redirectField]);

  const handleSave = (e) => {
    e.stopPropagation();
    const nextComps = page.components.map((c) => {
      if (c.id === comp.id) {
        return { 
          ...c, 
          content: { 
            ...c.content, 
            [field]: tempUrl,
            [redirectField]: tempRedirect 
          } 
        };
      }
      return c;
    });
    pushState({ ...page, components: nextComps });
    setShowPopup(false);
  };

  return (
    <div className="position-relative d-inline-block image-editable-wrapper" style={{ ...style }}>
      <img src={imgUrl || "placeholder.png"} className={className} style={{ width: "100%", height: "100%", maxHeight: style.maxHeight || "auto", objectFit: "contain" }} alt="Editable" />
      
      {/* Overlay */}
      <div 
        className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center cursor-pointer image-edit-hover-overlay"
        onClick={(e) => { e.stopPropagation(); setShowPopup(!showPopup); }}
        style={{ 
          background: "rgba(34, 73, 183, 0.45)", 
          opacity: 0, 
          transition: "opacity 0.2s",
          borderRadius: "4px"
        }}
      >
        <button className="btn btn-xs btn-light fw-bold shadow-sm" style={{ fontSize: "9px" }}>
          <i className="bi bi-pencil-fill me-1"></i>Edit
        </button>
      </div>

      {/* Floating popup input as screen modal */}
      {showPopup && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ zIndex: 9999, background: "rgba(15,23,42,0.3)", backdropFilter: "blur(2px)" }}
          onClick={(e) => { e.stopPropagation(); setShowPopup(false); }}
        >
          <div 
            className="bg-white border shadow-lg rounded-3 p-3 text-start" 
            style={{ width: "280px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
              <span className="fw-bold text-dark" style={{ fontSize: "11px" }}>Update Image / Logo</span>
              <button type="button" className="btn-close" style={{ fontSize: "8px" }} onClick={() => setShowPopup(false)}></button>
            </div>
            
            <div className="mb-3">
              <label className="form-label mb-1 fw-bold text-secondary text-uppercase" style={{ fontSize: "9px" }}>IMAGE / LOGO URL</label>
              <input 
                type="text" 
                className="form-control form-control-sm" 
                style={{ fontSize: "11px" }}
                value={tempUrl} 
                onChange={(e) => setTempUrl(e.target.value)} 
                placeholder="Paste image/logo URL" 
                autoFocus
              />
              <small className="text-muted d-block mt-1" style={{ fontSize: "9px" }}>Paste a direct link to your image or logo file.</small>
            </div>

            <div className="mb-3">
              <label className="form-label mb-1 fw-bold text-secondary text-uppercase" style={{ fontSize: "9px" }}>REDIRECT LINK (OPTIONAL)</label>
              <input 
                type="text" 
                className="form-control form-control-sm" 
                style={{ fontSize: "11px" }}
                value={tempRedirect} 
                onChange={(e) => setTempRedirect(e.target.value)} 
                placeholder="e.g. https://website.com or #" 
              />
              <small className="text-muted d-block mt-1" style={{ fontSize: "9px" }}>Where visitors will be redirected when they click this image/logo.</small>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-xs btn-light border" style={{ fontSize: "10px", padding: "2px 8px" }} onClick={() => setShowPopup(false)}>Cancel</button>
              <button className="btn btn-xs btn-primary fw-bold text-white" style={{ fontSize: "10px", padding: "2px 8px" }} onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderEnquiryFormFieldsMockup(targetForm, theme, textClass = "", inputClass = "") {
  const fields = targetForm?.fields || [];
  const selectedFields = fields.filter((f) => f.selected && !f.hidden);
  if (selectedFields.length === 0) {
    return <div className="small text-muted py-2 text-center">No fields configured on this form.</div>;
  }

  return (
    <div className="d-flex flex-column gap-3 mt-3 text-dark">
      {selectedFields.map((f, i) => {
        const label = f.label || f.fieldName;
        return (
          <div key={i} className="text-start">
            {f.fieldType === "checkbox" ? (
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={Boolean(f.defaultValue)} disabled />
                <label className={`form-check-label small fw-semibold ${textClass}`} style={{ fontSize: "11px" }}>
                  {label} {f.isRequired && <span className="text-danger">*</span>}
                </label>
              </div>
            ) : (
              <>
                <label className={`form-label fw-bold mb-1 ${textClass}`} style={{ fontSize: "11px" }}>
                  {label} {f.isRequired && <span className="text-danger">*</span>}
                </label>
                {f.fieldType === "select" ? (
                  <select className={`form-select form-select-sm ${inputClass}`} disabled>
                    <option value="">-- Choose option --</option>
                    {(typeof f.options === "string"
                      ? f.options.split(",").map(o => o.trim()).filter(Boolean)
                      : (Array.isArray(f.options) ? f.options : [])
                    ).map((opt, oi) => (
                      <option key={oi} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : f.fieldType === "textarea" ? (
                  <textarea className={`form-control form-control-sm ${inputClass}`} placeholder={`Enter ${label.toLowerCase()}`} rows={2} disabled />
                ) : (
                  <input type={f.fieldType || "text"} className={`form-control form-control-sm ${inputClass}`} placeholder={`Enter ${label.toLowerCase()}`} disabled />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderDynamicWizardForm(c, theme, textClass = "", inputClass = "") {
  const formType = c.content?.wizardFormType || c.wizardFormType || "enquiry";

  switch (formType) {
    case "registration":
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Parent Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Email Address</label>
            <input type="email" className={`form-control form-control-sm ${inputClass}`} placeholder="name@email.com" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Grade applying for</label>
            <select className={`form-select form-select-sm ${inputClass}`} disabled>
              <option>Preschool / Kindergarten</option>
              <option>Primary Grades (1-5)</option>
              <option>Middle School (6-8)</option>
              <option>High School (9-12)</option>
            </select>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Complete Registration</button>
        </div>
      );
    case "application":
    case "admission":
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Student Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Email Address</label>
            <input type="email" className={`form-control form-control-sm ${inputClass}`} placeholder="name@school.com" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Grade Applying For</label>
            <select className={`form-select form-select-sm ${inputClass}`} disabled>
              <option>Preschool / Nursery</option>
              <option>Primary School</option>
              <option>Secondary School</option>
            </select>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Upload Transfer Certificate</label>
            <input type="file" className={`form-control form-control-sm ${inputClass}`} disabled />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Application</button>
        </div>
      );
    case "payment":
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Candidate Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter candidate name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Fee Split Installments (Months)</label>
            <input type="range" className="form-range" min="1" max="12" disabled />
            <div className={`d-flex justify-content-between ${textClass}`} style={{ fontSize: "8px" }}><span>1 Month</span><span>6 Months</span><span>12 Months</span></div>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Payment Method</label>
            <select className={`form-select form-select-sm ${inputClass}`} disabled>
              <option>Credit / Debit Card</option>
              <option>UPI / PhonePe / GPay</option>
              <option>Netbanking</option>
            </select>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Pay & Estimate Fees</button>
        </div>
      );
    case "feedback":
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Full Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 d-block ${textClass}`} style={{ fontSize: "9px" }}>Overall Experience Rating</label>
            <div className="text-warning fs-5">★ ★ ★ ★ ☆</div>
          </div>
          <div className="form-check form-switch mt-1">
            <input className="form-check-input" type="checkbox" checked disabled />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Subscribe to newsletter</label>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Detailed Review / Comments</label>
            <textarea className={`form-control form-control-sm ${inputClass}`} rows={2} placeholder="Write details here" disabled />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Feedback</button>
        </div>
      );
    case "consent":
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Parent / Guardian Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Child Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter student name" disabled />
          </div>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked disabled />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Consent for school media publication</label>
          </div>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked disabled />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Agree to medical release policy</label>
          </div>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked disabled />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Agree to standard terms & conditions</label>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Consent Form</button>
        </div>
      );
    case "enquiry":
    default:
      return (
        <div className="d-flex flex-column gap-2 mt-2 text-start">
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Full Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" disabled />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Enquiry Details</label>
            <textarea className={`form-control form-control-sm ${inputClass}`} rows={2} placeholder="Write your requirements here" disabled />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Enquiry</button>
        </div>
      );
  }
}

const RESIZE_HANDLES = [
  { key: "nw", style: { top: -5, left: -5, cursor: "nwse-resize" } },
  { key: "n", style: { top: -5, left: "50%", marginLeft: -5, cursor: "ns-resize" } },
  { key: "ne", style: { top: -5, right: -5, cursor: "nesw-resize" } },
  { key: "e", style: { top: "50%", right: -5, marginTop: -5, cursor: "ew-resize" } },
  { key: "se", style: { bottom: -5, right: -5, cursor: "nwse-resize" } },
  { key: "s", style: { bottom: -5, left: "50%", marginLeft: -5, cursor: "ns-resize" } },
  { key: "sw", style: { bottom: -5, left: -5, cursor: "nesw-resize" } },
  { key: "w", style: { top: "50%", left: -5, marginTop: -5, cursor: "ew-resize" } },
];

const DRAG_THRESHOLD = 4;

function VisualBlock({
  comp,
  idx,
  isSelected,
  canvasRef,
  onSelect,
  onMoveCommit,
  onResizeCommit,
  cloneComponent,
  removeComponent,
  moveComponent,
  page,
  formsList,
  previewFormValues,
  setPreviewFormValues,
  renderEditableText,
  renderEditableImage,
  renderEditableLink,
  COMPONENT_TYPES,
  pushState,
  setIsDraggingActive,
  setActiveDragOverIndex,
  handleDragOverComponent,
  handleDropOnComponent
}) {
  const nodeRef = React.useRef(null);

  // Retrieve X/Y position from styles, default to a vertical stack if not set
  const posX = (comp.styles?.left && !isNaN(parseInt(comp.styles.left))) ? parseInt(comp.styles.left) : 24;
  const posY = (comp.styles?.top && !isNaN(parseInt(comp.styles.top))) ? parseInt(comp.styles.top) : (idx * 200 + 24);

  const [localPos, setLocalPos] = React.useState(null); // { x, y } while moving
  const [localSize, setLocalSize] = React.useState(null); // { width, height } while resizing
  const [isDragging, setIsDragging] = React.useState(false);

  const startMove = (e) => {
    // only react on left click on the component container or action bar
    if (e.button !== 0) return;

    const target = e.target;
    // Don't drag if clicking editable content, inputs, buttons, links or resize handles
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable ||
      target.closest("a") ||
      target.closest("button") ||
      target.closest(".image-editable-wrapper") ||
      target.closest(".resize-handle")
    ) {
      return;
    }

    onSelect();
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const blockEl = nodeRef.current;
    if (!blockEl) return;
    const parentEl = canvasRef.current;
    if (!parentEl) return;

    const nodeRect = blockEl.getBoundingClientRect();
    const canvasRect = parentEl.getBoundingClientRect();

    const originX = Math.round(nodeRect.left - canvasRect.left);
    const originY = Math.round(nodeRect.top - canvasRect.top);
    
    let currentX = originX;
    let currentY = originY;
    let moved = false;

    const maxX = Math.max(0, canvasRect.width - nodeRect.width);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        moved = true;
        setIsDragging(true);
      }

      if (!moved) return;

      const newX = Math.min(Math.max(0, originX + dx), maxX);
      const newY = Math.max(0, originY + dy);
      
      currentX = newX;
      currentY = newY;
      setLocalPos({ x: newX, y: newY });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      
      setLocalPos(null);
      setIsDragging(false);

      if (moved) {
        onMoveCommit({ x: currentX, y: currentY });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResize = (handleKey, e) => {
    e.preventDefault();
    e.stopPropagation();

    const blockEl = nodeRef.current;
    if (!blockEl) return;
    const parentEl = canvasRef.current;
    if (!parentEl) return;

    const blockRect = blockEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = blockRect.width;
    const startH = blockRect.height;
    const startLeft = blockRect.left - parentRect.left;
    const startTop = blockRect.top - parentRect.top;

    let currentW = startW;
    let currentH = startH;
    let currentLeft = startLeft;
    let currentTop = startTop;
    let hasMoved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      hasMoved = true;

      let newW = startW;
      let newH = startH;
      let newLeft = startLeft;
      let newTop = startTop;

      if (handleKey.includes("e")) {
        newW = startW + dx;
      }
      if (handleKey.includes("w")) {
        newW = startW - dx;
        newLeft = startLeft + dx;
      }
      if (handleKey.includes("s")) {
        newH = startH + dy;
      }
      if (handleKey.includes("n")) {
        newH = startH - dy;
        newTop = startTop + dy;
      }

      newW = Math.max(60, Math.round(newW));
      newH = Math.max(28, Math.round(newH));

      currentW = newW;
      currentH = newH;
      currentLeft = Math.max(0, Math.round(newLeft));
      currentTop = Math.max(0, Math.round(newTop));

      setLocalSize({ width: newW, height: newH });

      if (handleKey.includes("w") || handleKey.includes("n")) {
        setLocalPos({ x: currentLeft, y: currentTop });
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      setLocalSize(null);
      setLocalPos(null);

      if (hasMoved) {
        // Commit styling changes back to components styles list
        const nextComps = page.components.map((c) => {
          if (c.id === comp.id) {
            const updatedStyles = { ...c.styles };
            updatedStyles.width = `${currentW}px`;
            updatedStyles.height = `${currentH}px`;
            if (handleKey.includes("w") || handleKey.includes("n")) {
              updatedStyles.left = `${currentLeft}px`;
              updatedStyles.top = `${currentTop}px`;
            }
            return { ...c, styles: updatedStyles };
          }
          return c;
        });
        pushState({ ...page, components: nextComps });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const wrapperStyle = {
    paddingTop: comp.styles?.paddingTop || "0px",
    paddingBottom: comp.styles?.paddingBottom || "0px",
    paddingLeft: comp.styles?.paddingLeft || "0px",
    paddingRight: comp.styles?.paddingRight || "0px",
    marginTop: comp.styles?.marginTop || "0px",
    marginBottom: comp.styles?.marginBottom || "0px",
    marginLeft: comp.styles?.marginLeft || "auto",
    marginRight: comp.styles?.marginRight || "auto",
    width: localSize ? `${localSize.width}px` : (comp.styles?.width || "100%"),
    height: localSize ? `${localSize.height}px` : (comp.styles?.height || "auto"),
    backgroundColor: comp.styles?.backgroundColor || "transparent",
    color: comp.styles?.textColor || "inherit",
    borderRadius: comp.styles?.borderRadius || page.theme.borderRadius || "0px",
    borderWidth: comp.styles?.borderWidth || "0px",
    borderStyle: comp.styles?.borderWidth ? "solid" : "none",
    borderColor: comp.styles?.borderColor || "transparent",
    boxShadow: comp.styles?.boxShadow || "none",
    position: "absolute",
    left: localPos ? `${localPos.x}px` : (comp.styles?.left || `${posX}px`),
    top: localPos ? `${localPos.y}px` : (comp.styles?.top || `${posY}px`),
    zIndex: isSelected || isDragging ? 50 : parseInt(comp.styles?.zIndex) || 10,
    opacity: isDragging ? 0.6 : 1,
    overflow: isSelected ? "visible" : (localSize || comp.styles?.height !== "auto" ? "hidden" : "visible"),
    transition: isDragging ? "none" : "transform 150ms ease, box-shadow 150ms ease",
    cursor: isDragging ? "grabbing" : "grab"
  };

  return (
    <div
      ref={nodeRef}
      id={comp.id}
      onMouseDown={startMove}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`hover-builder-block ${isSelected ? "border-builder-selected" : ""}`}
      style={wrapperStyle}
    >
      {/* Hover Overlay controls - Draggable bar */}
      <div 
        className="builder-component-actions bg-wa text-white px-2 py-1 gap-1 shadow-sm animate-fade-in"
        style={{ cursor: "move", borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", zIndex: 100 }}
      >
        <span className="me-2 d-flex align-items-center">
          <i className="bi bi-arrows-move me-1 fs-6"></i>
          <span className="small fw-bold text-uppercase" style={{ fontSize: "9px" }}>
            {COMPONENT_TYPES.find((ct) => ct.type === comp.type)?.name || comp.type}
          </span>
          <span className="badge bg-dark text-warning ms-2 font-monospace" style={{ fontSize: "8px", padding: "2px 4px" }}>
            X: {localPos ? localPos.x : posX}px Y: {localPos ? localPos.y : posY}px
          </span>
        </span>
        
        <button className="btn btn-xs p-0 text-white" onClick={(e) => { e.stopPropagation(); cloneComponent(comp.id, e); }} title="Duplicate">
          <i className="bi bi-copy"></i>
        </button>
        <button className="btn btn-xs p-0 text-white" onClick={(e) => { e.stopPropagation(); removeComponent(comp.id, e); }} title="Delete">
          <i className="bi bi-trash"></i>
        </button>
      </div>

      {/* Rendering element layout styles */}
      <div className="w-100 h-100">
        {renderComponentLive(
          comp,
          page.theme,
          formsList,
          previewFormValues,
          setPreviewFormValues,
          renderEditableText,
          renderEditableImage,
          renderEditableLink
        )}
      </div>

      {/* Visual Resize Handles when Selected */}
      {isSelected && (
        <>
          {RESIZE_HANDLES.map((h) => (
            <span
              key={h.key}
              onMouseDown={(e) => startResize(h.key, e)}
              className="resize-handle"
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                background: "#fff",
                border: "2px solid #2249b7",
                borderRadius: 2,
                zIndex: 110,
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                ...h.style
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Helper to compile component schema into static HTML source code
function compileComponentsToHtml(components, theme) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Bootstrap Icons -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
  <style>
    :root {
      --primary-color: ${theme.primaryColor || '#2249b7'};
      --secondary-color: ${theme.secondaryColor || '#4f46e5'};
      --border-radius: ${theme.borderRadius || '12px'};
    }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: ${theme.backgroundColor || '#f8fafc'};
      color: #0f172a;
    }
  </style>
</head>
<body>

`;

  components.forEach((comp) => {
    const c = comp.content || {};
    if (comp.type === "custom-html") {
      html += `<!-- Custom HTML Section -->\n${c.htmlCode || ""}\n\n`;
    } else if (comp.type === "header-nav") {
      html += `<!-- Header Nav -->
<header class="bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
  <div class="d-flex align-items-center gap-2">
    <img src="${c.logoUrl}" style="max-height: 40px;" alt="Logo" />
    <span class="fw-bold fs-5">${c.brandName || "Brand"}</span>
  </div>
  <div class="d-flex align-items-center gap-4">
    ${(c.menuLinks || []).map(link => `<a href="${link.url}" class="text-secondary text-decoration-none fw-semibold small">${link.label}</a>`).join("")}
    ${c.showButton ? `<a href="${c.buttonLink}" class="btn btn-sm text-white fw-bold" style="background: var(--primary-color); border-radius: var(--border-radius);">${c.buttonText}</a>` : ""}
  </div>
</header>\n\n`;
    } else if (comp.type === "hero-split") {
      html += `<!-- Hero Split -->
<section class="py-5 px-4 bg-light">
  <div class="container py-4">
    <div class="row align-items-center g-5">
      <div class="col-lg-7">
        ${c.badgeText ? `<span class="badge bg-danger text-uppercase mb-3 px-3 py-2">${c.badgeText}</span>` : ""}
        <h1 class="display-4 fw-bold mb-3">${c.title || ""}</h1>
        <p class="lead text-secondary">${c.subtitle || ""}</p>
      </div>
      <div class="col-lg-5">
        <div class="card p-4 border-0 shadow-lg" style="border-radius: var(--border-radius);">
          <h5 class="fw-bold mb-3 text-center">${c.formTitle || "Submit Inquiry"}</h5>
          <form class="d-flex flex-column gap-3">
            <input type="text" class="form-control" placeholder="Full Name" required />
            <input type="email" class="form-control" placeholder="Email Address" required />
            <input type="tel" class="form-control" placeholder="Mobile Number" required />
            <button type="submit" class="btn text-white fw-bold w-100" style="background: var(--primary-color);">Submit</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>\n\n`;
    } else {
      // Fallback section label
      html += `<!-- Section: ${comp.type} -->
<section class="py-5 px-4 text-center border-bottom bg-white">
  <div class="container">
    <h3 class="fw-bold">${c.title || comp.type.toUpperCase()}</h3>
    <p class="text-secondary">${c.subtitle || ""}</p>
  </div>
</section>\n\n`;
    }
  });

  html += `<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

  return html;
}
