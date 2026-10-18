// Central definition of every node type the builder supports.

export const NODE_TYPES = {
  start: {
    label: 'Start (Trigger)',
    icon: 'bi-play-circle-fill',
    color: 'var(--primary)', // Start node uses the theme primary
    description: 'When the chat begins / a keyword is received',
    outputs: [{ key: 'next', label: '' }],
    defaultData: { keywords: ['hi', 'hello', 'start', 'enquiry'] },
  },
  message: {
    label: 'Send Message',
    icon: 'bi-chat-left-text-fill',
    color: 'var(--info)', // Clean Royal Blue
    description: 'Send a formatted text message with variables',
    outputs: [{ key: 'next', label: '' }],
    defaultData: { text: 'Hey there! 👋 Welcome to our WhatsApp service.' },
  },
  templateMessage: {
    label: 'Send Template',
    icon: 'bi-file-earmark-richtext-fill',
    color: 'var(--accent-foreground)',
    description: 'Send an approved WhatsApp template message',
    outputs: [{ key: 'next', label: '' }],
    defaultData: {
      templateName: 'order_update',
      languageCode: 'en',
      paramsCsv: '',
      previewText: 'Hi {{1}}, your update is ready.',
    },
  },
  mediaMessage: {
    label: 'Send Media',
    icon: 'bi-image-fill',
    color: '#4A6FA5',
    description: 'Send image/video/document/audio style message block',
    outputs: [{ key: 'next', label: '' }],
    defaultData: {
      mediaType: 'image',
      mediaUrl: '',
      caption: 'Please check this file.',
      filename: '',
    },
  },
  listMessage: {
    label: 'List Menu',
    icon: 'bi-list-ul',
    color: '#3D5A80',
    description: 'Send list-style options and branch on selection',
    outputs: 'dynamic',
    defaultData: {
      text: 'Please choose one option:',
      buttons: [
        { id: 'opt_1', label: 'Option 1' },
        { id: 'opt_2', label: 'Option 2' },
      ],
      buttonTitle: 'View options',
    },
  },
  locationMessage: {
    label: 'Send Location',
    icon: 'bi-geo-alt-fill',
    color: '#4C8DAE',
    description: 'Send a map location with optional place details',
    outputs: [{ key: 'next', label: '' }],
    defaultData: {
      latitude: '28.6139',
      longitude: '77.2090',
      name: 'Head Office',
      address: 'New Delhi',
    },
  },
  buttons: {
    label: 'Quick Reply Buttons',
    icon: 'bi-ui-radios',
    color: '#6A6FB0', // Indigo Purple
    description: 'Ask a question with tappable button options',
    outputs: 'dynamic', // built from data.buttons
    defaultData: {
      text: 'What would you like to do?',
      buttons: [
        { id: 'b1', label: 'Option 1' },
        { id: 'b2', label: 'Option 2' },
      ],
    },
  },
  question: {
    label: 'Ask a Question',
    icon: 'bi-patch-question-fill',
    color: '#B7883A', // Amber Orange
    description: 'Capture user reply into a variable',
    outputs: [{ key: 'next', label: '' }],
    defaultData: { text: 'Please enter your detail:', variableName: 'user_input', inputType: 'text' },
  },
  whatsappForm: {
    label: 'WhatsApp Form',
    icon: 'bi-ui-checks',
    color: '#3F7C9A', // Sky Cyan
    description: 'Send an interactive WhatsApp enquiry / registration form',
    outputs: [
      { key: 'submitted', label: 'On Submit' },
      { key: 'cancelled', label: 'On Cancel' },
    ],
    defaultData: {
      formId: '',
      saveResponseAs: 'form_data',
    },
  },
  apiRequest: {
    label: 'Call an API',
    icon: 'bi-cloud-arrow-down-fill',
    color: '#8564A8', // Deep Violet
    description: 'Fetch or send data to any HTTP REST API',
    outputs: [
      { key: 'success', label: 'On Success' },
      { key: 'error', label: 'On Error' },
    ],
    defaultData: {
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '',
      saveResponseAs: 'api_response',
    },
  },
  condition: {
    label: 'Multiple Conditions',
    icon: 'bi-signpost-split-fill',
    color: '#B8693A', // Dark Amber / Orange
    description: 'Branch the flow on multiple variables and AND/OR rules',
    outputs: 'dynamic_condition', // built from branches + else
    defaultData: {
      branches: [
        {
          id: 'branch_1',
          label: 'Branch 1',
          matchType: 'AND', // 'AND' | 'OR'
          rules: [
            { variable: 'api_response.userId', operator: 'equals', value: '1' },
          ],
        },
      ],
      elseLabel: 'Default (Else)',
    },
  },
  subchatbot: {
    label: 'Connect Sub-Bot',
    icon: 'bi-diagram-3-fill',
    color: '#2E8C7E', // Teal
    description: 'Hand off the conversation to another chatbot flow',
    outputs: [],
    defaultData: { targetBotId: '' },
  },
  end: {
    label: 'End Conversation',
    icon: 'bi-stop-circle-fill',
    color: 'var(--muted-foreground)', // Slate Dark Neutral
    description: 'Close the flow / conclude conversation',
    outputs: [],
    defaultData: { text: 'Thanks for connecting with us! 💚' },
  },
};

export const PALETTE_ORDER = [
  'start',
  'message',
  'templateMessage',
  'mediaMessage',
  'listMessage',
  'locationMessage',
  'buttons',
  'question',
  'whatsappForm',
  'apiRequest',
  'condition',
  'subchatbot',
  'end',
];
