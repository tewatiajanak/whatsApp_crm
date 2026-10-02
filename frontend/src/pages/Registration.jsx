import DateInput from "../components/DateInput";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { leadsApi, registrationsApi, workflowConfigApi, mastersApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, Field } from "../components/ui";

function compareStepsAndGroups(a, b) {
  const aName = (a.name || '').toLowerCase().trim();
  const bName = (b.name || '').toLowerCase().trim();
  
  if (aName === 'instructions' || aName === 'instruction') return -1;
  if (bName === 'instructions' || bName === 'instruction') return 1;
  
  if (aName === 'declaration') return 1;
  if (bName === 'declaration') return -1;
  
  return (a.seq || 0) - (b.seq || 0);
}

function renderFieldInput(field, value, onChange, labelStyle) {
  const commonProps = {
    className: "form-control",
    value: value || "",
    onChange: (e) => onChange(field.fieldName, e.target.value),
    placeholder: field.label
  };

  switch (field.fieldType) {
    case "email":
      return <input type="email" {...commonProps} />;
    case "phone":
      return <input type="tel" {...commonProps} />;
    case "number":
      return <input type="number" {...commonProps} />;
    case "textarea":
      return <textarea rows={3} {...commonProps} />;
    case "select":
      return (
        <select className="form-select" value={value || ""} onChange={(e) => onChange(field.fieldName, e.target.value)}>
          <option value="">Select {field.label}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "date":
      return <DateInput {...commonProps} />;
    case "checkbox":
      return (
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id={field.fieldName}
            checked={value === true || value === "true"}
            onChange={(e) => onChange(field.fieldName, e.target.checked)}
          />
          <label className="form-check-label" htmlFor={field.fieldName} style={labelStyle}>{field.label}</label>
        </div>
      );
    default:
      return <input type="text" {...commonProps} />;
  }
}

export default function Registration() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [interaction, setInteraction] = useState({ type: "", notes: "" });
  const [payment, setPayment] = useState({ amount: "", method: "", reference: "" });
  const [selectedStatus, setSelectedStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [declarationAgreed, setDeclarationAgreed] = useState({});

  const toggleDeclarationPointAgreed = (pointId, checked) => {
    setDeclarationAgreed((prev) => ({ ...prev, [pointId]: checked }));
  };

  const validateDeclarationAgreed = () => {
    if (activeForm && activeForm.declarationPoints && activeForm.declarationPoints.length > 0) {
      const requiredPoints = activeForm.declarationPoints.filter(p => p.requiredCheckbox);
      for (const p of requiredPoints) {
        if (!declarationAgreed[p.id]) {
          toast(`You must agree to: "${p.text || 'I agree'}"`, "error");
          return false;
        }
      }
    } else {
      if (!declarationAgreed["single"]) {
        toast("You must agree to the declaration statement to proceed.", "error");
        return false;
      }
    }
    return true;
  };

  const lead = useApi(() => leadsApi.get(leadId), [leadId]);
  const formsConfig = useApi(() => workflowConfigApi.get("registrationForms"), []);
  const oldConfig = useApi(() => workflowConfigApi.get("registrationForm"), []);
  const statuses = useApi(() => mastersApi.statuses(), []);

  const formsList = formsConfig.data?.forms || [];
  const activeForm = formsList.find(f => f.isActive) || formsList[0];

  const DEFAULT_THEME = {
    fontFamily: 'Default',
    cardBgColor: '#ffffff',
    cardBorderRadius: '12px',
    cardShadow: 'medium',
    width: '100%',
    pageBgColor: '#f1f5f9',
    pageBgGradient: 'none',
    containerPadding: '24px',
    fieldSpacing: 'normal',
    
    headerColor: '#1e293b',
    headerFontSize: '22px',
    headerAlign: 'center',
    headerBold: true,
    headerItalic: false,
    
    taglineColor: '#64748b',
    taglineFontSize: '14px',
    taglineAlign: 'center',
    
    groupNameColor: '#475569',
    groupNameBgColor: 'transparent',
    groupNameFontSize: '12px',
    groupNameAlign: 'left',
    groupNameBold: true,
    groupNameItalic: false,
    
    fieldLabelColor: '#334155',
    fieldLabelFontSize: '13px',
    fieldLabelBold: true,
    fieldLabelItalic: false,
    
    btnBgColor: '#00aa6d',
    btnTextColor: '#ffffff',
    btnBorderRadius: '6px',
    btnFontSize: '13px',
    btnBold: true,

    instColor: '#334155',
    instFontSize: '14px',
    instLineHeight: '1.6',
    
    declColor: '#475569',
    declFontSize: '12.5px',
    declBgColor: '#f8fafc',
    
    sidebarBgColor: '#f8fafc',
    sidebarTextColor: '#64748b',
    sidebarActiveColor: '#00aa6d',
    sidebarBorderColor: '#e2e8f0'
  };

  const getThemeVal = (prop) => {
    const t = activeForm?.theme || {};
    if (t[prop] !== undefined) return t[prop];
    return DEFAULT_THEME[prop];
  };

  const GRADIENTS = {
    none: '',
    cool: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    sunset: 'linear-gradient(135deg, #fffaf0 0%, #ffe4e6 100%)',
    emerald: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    cosmic: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    ocean: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
  };

  const getPageContainerStyles = () => {
    const pageBgColor = getThemeVal('pageBgColor') || '#f1f5f9';
    const pageBgGradient = getThemeVal('pageBgGradient') || 'none';
    let background = '';
    if (pageBgGradient !== 'none') {
      background = GRADIENTS[pageBgGradient];
    } else {
      background = pageBgColor;
    }
    return {
      background: background,
      padding: '24px',
      borderRadius: '12px'
    };
  };

  const getFieldSpacingStyles = () => {
    const spacingVal = getThemeVal('fieldSpacing') || 'normal';
    let spacing = '1rem';
    if (spacingVal === 'tight') spacing = '10px';
    else if (spacingVal === 'cozy') spacing = '14px';
    else if (spacingVal === 'spacious') spacing = '24px';
    return { marginBottom: spacing };
  };

  const getCardStyles = () => {
    const cardBgColor = getThemeVal('cardBgColor');
    const cardBorderRadius = getThemeVal('cardBorderRadius');
    const cardShadow = getThemeVal('cardShadow');
    const fontFamily = getThemeVal('fontFamily');
    const containerPadding = getThemeVal('containerPadding') || '24px';
    
    let shadow = 'none';
    if (cardShadow === 'small') shadow = '0 1px 3px rgba(0,0,0,0.1)';
    else if (cardShadow === 'medium') shadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
    else if (cardShadow === 'large') shadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';

    return {
      backgroundColor: cardBgColor,
      borderRadius: cardBorderRadius,
      boxShadow: shadow,
      fontFamily: fontFamily !== 'Default' ? `'${fontFamily}', sans-serif` : 'inherit',
      border: '1px solid var(--border)',
      padding: containerPadding
    };
  };

  const getTitleStyles = () => {
    return {
      color: getThemeVal('headerColor'),
      fontSize: getThemeVal('headerFontSize'),
      textAlign: getThemeVal('headerAlign'),
      fontWeight: getThemeVal('headerBold') ? 'bold' : 'normal',
      fontStyle: getThemeVal('headerItalic') ? 'italic' : 'normal',
      marginTop: 0,
      marginBottom: '4px'
    };
  };

  const getTaglineStyles = () => {
    return {
      color: getThemeVal('taglineColor'),
      fontSize: getThemeVal('taglineFontSize'),
      textAlign: getThemeVal('taglineAlign'),
      marginTop: '4px',
      marginBottom: 0
    };
  };

  const getGroupHeaderStyles = () => {
    return {
      color: getThemeVal('groupNameColor'),
      backgroundColor: getThemeVal('groupNameBgColor'),
      fontSize: getThemeVal('groupNameFontSize'),
      textAlign: getThemeVal('groupNameAlign'),
      fontWeight: getThemeVal('groupNameBold') ? 'bold' : 'normal',
      fontStyle: getThemeVal('groupNameItalic') ? 'italic' : 'normal',
      padding: '8px 12px',
      borderRadius: '4px',
      marginBottom: '14px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em'
    };
  };

  const getFieldLabelStyles = () => {
    return {
      color: getThemeVal('fieldLabelColor'),
      fontSize: getThemeVal('fieldLabelFontSize'),
      fontWeight: getThemeVal('fieldLabelBold') ? 'bold' : 'normal',
      fontStyle: getThemeVal('fieldLabelItalic') ? 'italic' : 'normal',
      marginBottom: '6px'
    };
  };

  const getBtnStyles = () => {
    return {
      backgroundColor: getThemeVal('btnBgColor'),
      color: getThemeVal('btnTextColor'),
      borderRadius: getThemeVal('btnBorderRadius'),
      fontSize: getThemeVal('btnFontSize'),
      fontWeight: getThemeVal('btnBold') ? 'bold' : 'normal',
      border: 'none',
      padding: '8px 18px',
      cursor: 'pointer'
    };
  };

  const getInstStyles = () => {
    return {
      whiteSpace: "pre-wrap",
      color: getThemeVal('instColor'),
      fontSize: getThemeVal('instFontSize'),
      lineHeight: getThemeVal('instLineHeight'),
      marginBottom: "24px"
    };
  };

  const getDeclBoxStyles = () => {
    return {
      backgroundColor: getThemeVal('declBgColor'),
      color: getThemeVal('declColor'),
      fontSize: getThemeVal('declFontSize'),
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      marginBottom: '16px',
      textAlign: 'left'
    };
  };

  const getDeclTextStyles = () => {
    return {
      color: getThemeVal('declColor'),
      fontSize: getThemeVal('declFontSize')
    };
  };

  const getSidebarStyles = () => {
    return {
      width: '200px',
      backgroundColor: getThemeVal('sidebarBgColor'),
      borderRight: `1px solid ${getThemeVal('sidebarBorderColor')}`,
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flexShrink: 0
    };
  };

  const getSidebarStepItemStyles = (isActive, isDone) => {
    const activeColor = getThemeVal('sidebarActiveColor');
    const textColor = getThemeVal('sidebarTextColor');
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: isActive ? '600' : '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      backgroundColor: isActive ? `${activeColor}15` : 'transparent',
      color: isActive ? activeColor : textColor
    };
  };

  const getSidebarDotStyles = (isActive, isDone) => {
    const activeColor = getThemeVal('sidebarActiveColor');
    let bg = '#cbd5e1';
    let color = '#ffffff';
    if (isActive || isDone) {
      bg = activeColor;
      color = '#ffffff';
    }
    return {
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: bg,
      color: color,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '700',
      flexShrink: 0
    };
  };

  useEffect(() => {
    const fontFamily = getThemeVal('fontFamily');
    const linkId = "google-font-link-live-registration";
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (fontFamily && fontFamily !== "Default") {
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@400;500;600;700&display=swap`;
    } else {
      link.href = "";
    }
    return () => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [activeForm]);

  let mode = "single";
  let fields = [
    { fieldName: "name", label: "Name", fieldType: "text", isRequired: true, helpText: "" },
    { fieldName: "phone", label: "Phone", fieldType: "phone", isRequired: true, helpText: "" },
    { fieldName: "email", label: "Email", fieldType: "email", isRequired: false, helpText: "" },
    { fieldName: "course", label: "Course", fieldType: "text", isRequired: false, helpText: "" }
  ];
  let steps = [{ title: "Registration", type: "form", fieldNames: fields.map((f) => f.fieldName) }];
  let documentTypes = [];

  if (activeForm) {
    const allFields = [];
    activeForm.steps.forEach((s) => {
      s.groups.forEach((g) => {
        if (g.fields) {
          g.fields.forEach((f) => {
            const fName = f.fieldName || f.label.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
            allFields.push({
              fieldName: fName,
              label: f.label,
              fieldType: f.type || "text",
              isRequired: Boolean(f.mandatory),
              helpText: ""
            });
          });
        }
      });
    });

    if (allFields.length) {
      fields = allFields;
    }

    // Enforce 2 steps: 1st page instruction, 2nd page complete form with declaration and payment
    const formStepFieldNames = [];
    const formStepGroups = [];
    let hasPayment = false;

    activeForm.steps
      .slice()
      .sort(compareStepsAndGroups)
      .forEach((s) => {
        const lowerName = s.name.toLowerCase();
        if (lowerName !== "instructions" && lowerName !== "instruction" && lowerName !== "declaration") {
          if (lowerName === "payment" || lowerName.includes("payment")) {
            hasPayment = true;
          }
          s.groups.forEach((g) => {
            formStepGroups.push(g);
            if (g.fields) {
              g.fields.forEach((f) => {
                const fName = f.fieldName || f.label.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
                formStepFieldNames.push(fName);
              });
            }
          });
        }
      });

    steps = [
      {
        title: "Instructions",
        type: "instructions",
        text: activeForm.instructions || "Please read the instructions carefully before filling out the form."
      },
      {
        title: "Registration Form",
        type: "form",
        fieldNames: formStepFieldNames,
        groups: formStepGroups,
        hasPayment: hasPayment,
        declarationPoints: activeForm.declarationPoints || [],
        declarationText: activeForm.declarationText || "I hereby declare that all the information provided in this form is true and correct to the best of my knowledge."
      }
    ];

    mode = "multistep";

    documentTypes = fields
      .filter((f) => f.fieldType === "file")
      .map((f) => ({ _id: f.fieldName, name: f.label, required: f.isRequired }));
  } else if (oldConfig.data) {
    const registrationConfig = oldConfig.data || {};
    fields = registrationConfig.fields || fields;
    
    const formSteps = registrationConfig.steps || [{ title: "Registration", type: "form", fieldNames: fields.map((f) => f.fieldName) }];
    
    const allFieldNames = [];
    formSteps.forEach(s => {
      if (s.fieldNames) {
        allFieldNames.push(...s.fieldNames);
      }
    });

    steps = [
      {
        title: "Instructions",
        type: "instructions",
        text: registrationConfig.instructions || "Please read the instructions carefully before filling out the form."
      },
      {
        title: "Registration Form",
        type: "form",
        fieldNames: allFieldNames,
        groups: null,
        hasPayment: false,
        declarationPoints: [],
        declarationText: registrationConfig.declarationText || "I hereby declare that all the information provided in this form is true and correct to the best of my knowledge."
      }
    ];
    mode = "multistep";
    
    documentTypes = registrationConfig.documentTypes || [];
  } else {
    steps = [
      {
        title: "Instructions",
        type: "instructions",
        text: "Please read the instructions carefully before filling out the form."
      },
      {
        title: "Registration Form",
        type: "form",
        fieldNames: fields.map((f) => f.fieldName),
        groups: null,
        hasPayment: false,
        declarationPoints: [],
        declarationText: "I hereby declare that all the information provided in this form is true and correct to the best of my knowledge."
      }
    ];
    mode = "multistep";
  }

  useEffect(() => {
    if (lead.data) {
      const initial = { ...lead.data };
      fields.forEach((field) => {
        if (initial[field.fieldName] === undefined) {
          initial[field.fieldName] = field.fieldType === "checkbox" ? false : "";
        }
      });
      setFormData({
        name: lead.data.name || "",
        phone: lead.data.phone || "",
        email: lead.data.email || "",
        course: lead.data.course || "",
        ...initial
      });
    }
  }, [lead.data, fields]);

  const currentStep = steps[activeStep] || {};
  const currentStepName = currentStep.title || "Step";

  const setFieldValue = (fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const toggleDocument = (id) => {
    setDocuments((prev) => (prev.includes(id) ? prev.filter((doc) => doc !== id) : [...prev, id]));
  };

  const renderFormFields = (fieldNames) => {
    const visibleFields = fieldNames?.length
      ? fields.filter((field) => fieldNames.includes(field.fieldName))
      : fields;

    return visibleFields.map((field) => (
      <div style={getFieldSpacingStyles()} key={field.fieldName}>
        {field.fieldType !== "checkbox" ? (
          <>
            <label className="form-label" style={getFieldLabelStyles()}>
              {field.label}{field.isRequired && <span className="text-danger">*</span>}
            </label>
            {renderFieldInput(field, formData[field.fieldName], setFieldValue, getFieldLabelStyles())}
            {field.helpText && <div className="form-text">{field.helpText}</div>}
          </>
        ) : (
          renderFieldInput(field, formData[field.fieldName], setFieldValue, getFieldLabelStyles())
        )}
      </div>
    ));
  };

  const validateStep = () => {
    if (currentStep.type === "instructions") {
      return true;
    }
    if (currentStep.type === "form") {
      // 1. Validate form fields
      const requiredFields = fields.filter((field) => field.isRequired && (!currentStep.fieldNames || currentStep.fieldNames.includes(field.fieldName)));
      for (const field of requiredFields) {
        const value = formData[field.fieldName];
        if (field.fieldType === "checkbox") {
          if (value !== true) {
            toast(`${field.label} is required`, "error");
            return false;
          }
        } else if (!value || !String(value).trim()) {
          toast(`${field.label} is required`, "error");
          return false;
        }
      }

      // 2. Validate payment if hasPayment is true
      if (currentStep.hasPayment && !payment.amount) {
        toast("Payment amount is required", "error");
        return false;
      }

      // 3. Validate declaration checkboxes
      return validateDeclarationAgreed();
    }
    return true;
  };

  const isLastStep = () => activeStep === steps.length - 1;

  const handleNext = () => {
    if (!validateStep()) return;
    setActiveStep((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    if (mode !== "single" && !validateStep()) return;
    if (mode === "multistep" && !isLastStep()) {
      handleNext();
      return;
    }

    // Validation for required form fields in single mode
    if (mode === "single") {
      const hasDeclarationGroup = activeForm && activeForm.steps[0]?.groups.some(g => g.name.toLowerCase() === "declaration");
      if (hasDeclarationGroup && !validateDeclarationAgreed()) {
        return;
      }
      const required = fields.filter((field) => field.isRequired);
      for (const field of required) {
        const value = formData[field.fieldName];
        if (field.fieldType === "checkbox") {
          if (value !== true) {
            toast(`${field.label} is required`, "error");
            return;
          }
        } else if (!value || !String(value).trim()) {
          toast(`${field.label} is required`, "error");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        lead: leadId,
        ...Object.fromEntries(fields.map((field) => [field.fieldName, formData[field.fieldName] ?? ""])),
        documents: documentTypes.filter((doc) => documents.includes(doc._id)).map((doc) => ({ _id: doc._id, name: doc.name })),
        interaction: interaction.type || interaction.notes ? interaction : undefined,
        payment: payment.amount || payment.method || payment.reference ? payment : undefined,
        status: selectedStatus || undefined,
      };
      await registrationsApi.create(payload);
      toast("Registration submitted successfully");
      navigate("/crm/leads");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (lead.loading || formsConfig.loading || oldConfig.loading || statuses.loading) return <Spinner />;
  if (lead.error) return <ErrorBox error={lead.error} />;
  if (!lead.data) return <ErrorBox error={{ message: "Lead not found" }} />;

  const pageBgColor = getThemeVal('pageBgColor') || '#f1f5f9';
  const pageBgGradient = getThemeVal('pageBgGradient') || 'none';
  let background = '';
  if (pageBgGradient !== 'none') {
    background = GRADIENTS[pageBgGradient];
  } else {
    background = pageBgColor;
  }



  return (
    <div>
      <PageHeader
        title="Registration"
        subtitle={`Lead: ${lead.data.name} • ${lead.data.phone}`}
        actions={<button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>Back</button>}
      />

      <div className="card mb-4" style={getPageContainerStyles()}>
        <div className="card-body p-0">
          <div className="mb-3 p-3 border-bottom d-flex justify-content-between align-items-center">
            <div><strong>Registration mode:</strong> {mode === "single" ? "Single form" : "Multi-step"}</div>
          </div>
          <div style={{ display: 'flex', minHeight: 480, flexDirection: 'row', flexWrap: 'wrap' }}>
            {mode === "multistep" && (
              <div style={getSidebarStyles()}>
                {steps.map((step, idx) => {
                  const isActive = idx === activeStep;
                  const isDone = idx < activeStep;
                  return (
                    <div
                      key={idx}
                      style={getSidebarStepItemStyles(isActive, isDone)}
                      onClick={() => setActiveStep(idx)}
                    >
                      <span style={getSidebarDotStyles(isActive, isDone)}>{isDone ? '✓' : idx + 1}</span>
                      <span>{step.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', padding: '24px' }}>
              <div className="card" style={{ minHeight: 320, ...getCardStyles(), border: 'none', boxShadow: 'none' }}>
                <div className="card-body">
                  {activeForm && (activeForm.headerName || activeForm.tagline) && (
                    <div className="mb-4 pb-3 border-bottom text-center">
                      {activeForm.headerName && <h2 style={getTitleStyles()}>{activeForm.headerName}</h2>}
                      {activeForm.tagline && <p style={getTaglineStyles()}>{activeForm.tagline}</p>}
                    </div>
                  )}

                  {currentStep.type === "instructions" && (
                    <div style={{ flex: 1 }}>
                      <h6 style={getGroupHeaderStyles()}>{currentStep.title}</h6>
                      <p style={getInstStyles()}>
                        {currentStep.text || "No instructions provided."}
                      </p>
                    </div>
                  )}

                  {currentStep.type === "form" && (
                    <>
                      {currentStep.groups ? (
                        currentStep.groups.map((g) => {
                          const groupFieldNames = (g.fields || []).map((f) => {
                            return f.fieldName || f.label.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
                          });
                          if (!groupFieldNames.length) return null;
                          return (
                            <div className="mb-4 text-start" key={g.id}>
                              <h6 style={getGroupHeaderStyles()}>{g.name}</h6>
                              {renderFormFields(groupFieldNames)}
                            </div>
                          );
                        })
                      ) : (
                        renderFormFields(currentStep.fieldNames || fields.map((f) => f.fieldName))
                      )}

                      {currentStep.hasPayment && (
                        <div className="mb-4 text-start">
                          <h6 style={getGroupHeaderStyles()}>Payment Details</h6>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <Field label="Amount">
                                <input className="form-control" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                              </Field>
                            </div>
                            <div className="col-md-4">
                              <Field label="Payment method">
                                <input className="form-control" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} />
                              </Field>
                            </div>
                            <div className="col-md-4">
                              <Field label="Reference">
                                <input className="form-control" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                              </Field>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mb-4 pt-3 border-top text-start">
                        <h6 style={getGroupHeaderStyles()}>Declaration</h6>
                        <div style={getDeclBoxStyles()}>
                          {currentStep.declarationPoints && currentStep.declarationPoints.length > 0 ? (
                            currentStep.declarationPoints.map((p) => (
                              <div key={p.id} className="mb-3">
                                {p.requiredCheckbox ? (
                                  <div className="form-check">
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      id={`decl-${p.id}`}
                                      checked={!!declarationAgreed[p.id]}
                                      onChange={(e) => toggleDeclarationPointAgreed(p.id, e.target.checked)}
                                    />
                                    <label className="form-check-label fw-medium text-start" htmlFor={`decl-${p.id}`} style={{ cursor: "pointer", ...getDeclTextStyles() }}>
                                      {p.text}
                                    </label>
                                  </div>
                                ) : (
                                  <div className="ps-4 text-start" style={getDeclTextStyles()}>
                                    • {p.text}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div>
                              <p style={{ whiteSpace: "pre-wrap", ...getDeclTextStyles(), lineHeight: "1.5" }}>
                                {currentStep.declarationText || "I hereby declare that all the information provided in this form is true and correct to the best of my knowledge."}
                              </p>
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="declaration-checkbox-fallback"
                                  checked={!!declarationAgreed["single"]}
                                  onChange={(e) => toggleDeclarationPointAgreed("single", e.target.checked)}
                                />
                                <label className="form-check-label fw-medium" htmlFor="declaration-checkbox-fallback" style={{ cursor: "pointer", ...getDeclTextStyles() }}>
                                  I agree to the declaration statement.
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Field label="Status after registration">
                        <select className="form-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                          <option value="">Select status</option>
                          {(statuses.data || []).map((s) => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                          ))}
                        </select>
                      </Field>
                    </>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                {activeStep > 0 && (
                  <button className="btn btn-outline-secondary" onClick={handleBack}>Back</button>
                )}
                <button style={getBtnStyles()} onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : activeStep === 0 ? "Next Step" : (currentStep.hasPayment ? "Proceed to Payment" : "Save")}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
