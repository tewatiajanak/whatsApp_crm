import React, { createContext, useContext, useEffect, useState } from 'react';
import { uid } from '../utils/id';
import { NODE_TYPES } from '../data/nodeTypes';
import { seedData } from '../data/seedData';
import { flowStudioApi } from '../../api';

const BotContext = createContext(null);
const STORAGE_KEY = 'flowchat_studio_data_v4';
const FORMS_STORAGE_KEY = 'flowchat_studio_forms_v1';

const defaultSeedForms = [
  {
    id: 'form_admissions_1',
    name: 'Student Admission Enquiry Form',
    status: 'active',
    description: 'Collect student name, course, phone, email, and preferred admission intake.',
    submitButtonText: 'Submit Enquiry',
    submitSuccessMessage: 'Thank you! Your admission enquiry has been submitted successfully.',
    targetApiUrl: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'f_name', label: 'Full Name', fieldKey: 'full_name', type: 'text', required: true, placeholder: '' },
      { id: 'f_phone', label: 'WhatsApp / Contact Number', fieldKey: 'phone', type: 'phone', required: true, placeholder: '' },
      { id: 'f_email', label: 'Email Address', fieldKey: 'email', type: 'email', required: true, placeholder: '' },
      { id: 'f_course', label: 'Interested Program / Course', fieldKey: 'course', type: 'select', required: true, placeholder: '', options: ['B.Tech Computer Science', 'MBA Leadership', 'B.Des UI/UX', 'B.Com Honours'] },
      { id: 'f_date', label: 'Expected Admission Year / Date', fieldKey: 'admission_date', type: 'date', required: false, placeholder: '' },
      { id: 'f_remarks', label: 'Questions or Special Requests', fieldKey: 'remarks', type: 'text', required: false, placeholder: '' },
    ],
  },
  {
    id: 'form_feedback_2',
    name: 'Campus Visit Booking Form',
    status: 'active',
    description: 'Schedule an on-campus tour with parent name, date, and visitor count.',
    submitButtonText: 'Confirm Visit Booking',
    submitSuccessMessage: 'Your campus visit has been scheduled! Our team will send directions on WhatsApp.',
    targetApiUrl: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'fv_parent', label: 'Parent / Visitor Name', fieldKey: 'visitor_name', type: 'text', required: true, placeholder: '' },
      { id: 'fv_phone', label: 'Phone Number', fieldKey: 'phone', type: 'phone', required: true, placeholder: '' },
      { id: 'fv_count', label: 'Number of Visitors', fieldKey: 'visitor_count', type: 'number', required: true, placeholder: '' },
      { id: 'fv_date', label: 'Preferred Visit Date', fieldKey: 'visit_date', type: 'date', required: true, placeholder: '' },
      { id: 'fv_slot', label: 'Preferred Time Slot', fieldKey: 'time_slot', type: 'select', required: true, placeholder: '', options: ['Morning 10:00 AM - 12:00 PM', 'Afternoon 02:00 PM - 04:00 PM'] },
    ],
  },
];

function normalizeNodes(nodes) {
  if (!nodes) return {};
  const clean = JSON.parse(JSON.stringify(nodes));
  Object.keys(clean).forEach((id) => {
    const node = clean[id];
    if (node && node.position) {
      if (typeof node.position.x !== 'number' || node.position.x < 20) {
        node.position.x = Math.max(60, (node.position.x || 0) + 400);
      }
      if (typeof node.position.y !== 'number' || node.position.y < 20) {
        node.position.y = 120;
      }
    }
  });
  return clean;
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.clients) && Array.isArray(parsed.bots) && parsed.clients.length > 0 && parsed.bots.length > 0) {
        parsed.bots = parsed.bots.map((b) => ({
          ...b,
          nodes: normalizeNodes(b.nodes),
        }));
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read saved data, starting fresh.', e);
  }
  return seedData;
}

function loadInitialForms() {
  try {
    const raw = localStorage.getItem(FORMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read saved forms, starting fresh.', e);
  }
  return defaultSeedForms;
}

export function BotProvider({ children }) {
  const [clients, setClients] = useState(() => (loadInitial() && loadInitial().clients) || seedData.clients);
  const [bots, setBots] = useState(() => (loadInitial() && loadInitial().bots) || seedData.bots);
  const [forms, setForms] = useState(() => loadInitialForms());
  const [stateHydrated, setStateHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('wacrm_token');

    if (!token) {
      setStateHydrated(true);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const res = await flowStudioApi.getState();
        const remote = res?.data || {};
        if (!mounted) return;

        const remoteClients = Array.isArray(remote.clients) ? remote.clients : [];
        const remoteBots = Array.isArray(remote.bots) ? remote.bots.map((b) => ({ ...b, nodes: normalizeNodes(b.nodes) })) : [];
        const remoteForms = Array.isArray(remote.forms) ? remote.forms : [];

        if (remoteClients.length) setClients(remoteClients);
        if (remoteBots.length) setBots(remoteBots);
        if (remoteForms.length) setForms(remoteForms);
      } catch (err) {
        console.warn('Could not load FlowChat state from backend. Using local state.', err);
      } finally {
        if (mounted) setStateHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients, bots }));
  }, [clients, bots]);

  useEffect(() => {
    localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(forms));
  }, [forms]);

  const saveToBackendNow = async (latestClients, latestBots, latestForms) => {
    try {
      await flowStudioApi.saveState({
        clients: latestClients || clients,
        bots: latestBots || bots,
        forms: latestForms || forms,
        meta: {},
      });
    } catch (err) {
      console.warn('Could not save FlowChat state to backend.', err);
    }
  };

  useEffect(() => {
    if (!stateHydrated) return;
    if (!localStorage.getItem('wacrm_token')) return;

    const timer = setTimeout(async () => {
      try {
        await flowStudioApi.saveState({ clients, bots, forms, meta: {} });
      } catch (err) {
        console.warn('Could not save FlowChat state to backend. Local backup kept.', err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [clients, bots, forms, stateHydrated]);

  // ---------- Clients ----------
  const addClient = (name, industry) => {
    const client = { id: uid('client'), name, industry, createdAt: Date.now() };
    setClients((prev) => {
      const next = [...prev, client];
      saveToBackendNow(next, bots, forms);
      return next;
    });
    return client;
  };

  const deleteClient = (clientId) => {
    setClients((prev) => {
      const nextClients = prev.filter((c) => c.id !== clientId);
      const nextBots = bots.filter((b) => b.clientId !== clientId);
      saveToBackendNow(nextClients, nextBots, forms);
      return nextClients;
    });
    setBots((prev) => prev.filter((b) => b.clientId !== clientId));
  };

  // ---------- Bots ----------
  const createBot = (clientId, name) => {
    const startId = uid('node');
    const bot = {
      id: uid('bot'),
      clientId,
      name,
      status: 'live',
      updatedAt: Date.now(),
      meta: { phoneNumberId: '', wabaId: '', accessToken: '', verifyToken: '' },
      startNodeId: startId,
      nodes: {
        [startId]: {
          id: startId,
          type: 'start',
          position: { x: 80, y: 160 },
          data: { ...NODE_TYPES.start.defaultData },
          connections: {},
        },
      },
    };
    setBots((prev) => {
      const next = [...prev, bot];
      saveToBackendNow(clients, next, forms);
      return next;
    });
    return bot;
  };

  const duplicateBot = (botId) => {
    const original = bots.find((b) => b.id === botId);
    if (!original) return;
    const clone = {
      ...original,
      id: uid('bot'),
      name: original.name + ' (Copy)',
      status: 'draft',
      updatedAt: Date.now(),
    };
    setBots((prev) => {
      const next = [...prev, clone];
      saveToBackendNow(clients, next, forms);
      return next;
    });
  };

  const deleteBot = (botId) => {
    setBots((prev) => {
      const next = prev.filter((b) => b.id !== botId);
      saveToBackendNow(clients, next, forms);
      return next;
    });
  };

  const updateBotMeta = (botId, patch) => {
    setBots((prev) => {
      const next = prev.map((b) => (b.id === botId ? { ...b, ...patch, updatedAt: Date.now() } : b));
      saveToBackendNow(clients, next, forms);
      return next;
    });
  };

  const updateBotSettings = (botId, meta) =>
    setBots((prev) =>
      prev.map((b) => (b.id === botId ? { ...b, meta: { ...b.meta, ...meta }, updatedAt: Date.now() } : b))
    );

  // ---------- Nodes ----------
  const addNode = (botId, type, position) => {
    const id = uid('node');
    const def = NODE_TYPES[type];
    const safePos = {
      x: Math.max(20, position?.x ?? 200),
      y: Math.max(20, position?.y ?? 150),
    };
    setBots((prev) => {
      const next = prev.map((b) => {
        if (b.id !== botId) return b;
        return {
          ...b,
          updatedAt: Date.now(),
          nodes: {
            ...b.nodes,
            [id]: {
              id,
              type,
              position: safePos,
              data: JSON.parse(JSON.stringify(def?.defaultData || {})),
              connections: {},
            },
          },
        };
      });
      saveToBackendNow(clients, next, forms);
      return next;
    });
    return id;
  };

  const updateNodePosition = (botId, nodeId, position) =>
    setBots((prev) => {
      const safePos = {
        x: Math.max(20, position?.x ?? 20),
        y: Math.max(20, position?.y ?? 20),
      };
      return prev.map((b) => {
        if (b.id !== botId) return b;
        return { ...b, nodes: { ...b.nodes, [nodeId]: { ...b.nodes[nodeId], position: safePos } } };
      });
    });

  const updateNodeData = (botId, nodeId, data) =>
    setBots((prev) => {
      const next = prev.map((b) => {
        if (b.id !== botId) return b;
        return {
          ...b,
          updatedAt: Date.now(),
          nodes: { ...b.nodes, [nodeId]: { ...b.nodes[nodeId], data: { ...b.nodes[nodeId].data, ...data } } },
        };
      });
      saveToBackendNow(clients, next, forms);
      return next;
    });

  const setConnection = (botId, nodeId, outputKey, targetId) =>
    setBots((prev) => {
      const next = prev.map((b) => {
        if (b.id !== botId) return b;
        const node = b.nodes[nodeId];
        return {
          ...b,
          updatedAt: Date.now(),
          nodes: {
            ...b.nodes,
            [nodeId]: { ...node, connections: { ...node.connections, [outputKey]: targetId || null } },
          },
        };
      });
      saveToBackendNow(clients, next, forms);
      return next;
    });

  const deleteNode = (botId, nodeId) =>
    setBots((prev) => {
      const next = prev.map((b) => {
        if (b.id !== botId || nodeId === b.startNodeId) return b;
        const nodes = { ...b.nodes };
        delete nodes[nodeId];
        // clear dangling connections pointing to the removed node
        Object.values(nodes).forEach((n) => {
          Object.keys(n.connections || {}).forEach((k) => {
            if (n.connections[k] === nodeId) n.connections[k] = null;
          });
        });
        return { ...b, nodes, updatedAt: Date.now() };
      });
      saveToBackendNow(clients, next, forms);
      return next;
    });

  // ---------- WhatsApp Forms Management ----------
  const addForm = (formData) => {
    const newForm = {
      id: uid('wa_form'),
      name: formData.name || 'New WhatsApp Form',
      description: formData.description || '',
      status: formData.status || 'active',
      submitButtonText: formData.submitButtonText || 'Submit Form',
      submitSuccessMessage: formData.submitSuccessMessage || 'Thank you! Your submission has been received.',
      targetApiUrl: formData.targetApiUrl || '',
      fields: formData.fields || [
        { id: uid('field'), label: 'Full Name', fieldKey: 'full_name', type: 'text', required: true, placeholder: '' },
        { id: uid('field'), label: 'Phone Number', fieldKey: 'phone', type: 'phone', required: true, placeholder: '' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setForms((prev) => {
      const next = [...prev, newForm];
      saveToBackendNow(clients, bots, next);
      return next;
    });
    return newForm;
  };

  const updateForm = (formId, patch) => {
    setForms((prev) => {
      const next = prev.map((f) => (f.id === formId ? { ...f, ...patch, updatedAt: Date.now() } : f));
      saveToBackendNow(clients, bots, next);
      return next;
    });
  };

  const deleteForm = (formId) => {
    if (isFormInUse(formId)) {
      return false;
    }
    setForms((prev) => {
      const next = prev.filter((f) => f.id !== formId);
      saveToBackendNow(clients, bots, next);
      return next;
    });
    return true;
  };

  const duplicateForm = (formId) => {
    const original = forms.find((f) => f.id === formId);
    if (!original) return;
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: uid('wa_form'),
      name: original.name + ' (Copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setForms((prev) => {
      const next = [...prev, clone];
      saveToBackendNow(clients, bots, next);
      return next;
    });
  };

  const isFormInUse = (formId) => {
    if (!formId) return false;
    return (bots || []).some((bot) =>
      Object.values(bot.nodes || {}).some(
        (node) => node?.type === 'whatsappForm' && node?.data?.formId === formId
      )
    );
  };

  const toggleFormStatus = (formId) => {
    setForms((prev) => {
      const next = prev.map((f) =>
        f.id === formId
          ? { ...f, status: f.status === 'inactive' ? 'active' : 'inactive', updatedAt: Date.now() }
          : f
      );
      saveToBackendNow(clients, bots, next);
      return next;
    });
  };

  const value = {
    clients: clients || [],
    bots: bots || [],
    forms: forms || [],
    addClient,
    deleteClient,
    createBot,
    duplicateBot,
    deleteBot,
    updateBotMeta,
    updateBotSettings,
    addNode,
    updateNodePosition,
    updateNodeData,
    setConnection,
    deleteNode,
    addForm,
    updateForm,
    deleteForm,
    duplicateForm,
    isFormInUse,
    toggleFormStatus,
    saveToBackendNow,
    stateHydrated,
  };

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}

export const useBots = () => useContext(BotContext);
