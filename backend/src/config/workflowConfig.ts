export const WORKFLOW_EVENTS = [
  { key: "lead.created", label: "Lead Created" },
  { key: "lead.status_changed", label: "Lead Status Changed" },
  { key: "lead.assigned", label: "Lead Assigned" },
  { key: "followup.due", label: "Follow-up Due" },
  { key: "lead.note_added", label: "Note Added" },
  { key: "lead.sla_breached", label: "First Response Overdue" },
  { key: "lead.won", label: "Lead Won" },
  { key: "lead.lost", label: "Lead Lost" },
  { key: "payment.received", label: "Payment Received" },
];

export const CONDITION_FIELDS = [
  { key: "name", label: "Student Name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "score", label: "Lead Score", type: "number" },
  { key: "source", label: "Source", type: "ref:LeadSource" },
  { key: "status", label: "Status", type: "ref:LeadStatus" },
  { key: "service", label: "Service", type: "ref:Service" },
  { key: "subStatus", label: "Sub Status", type: "ref:SubStatus" },
  { key: "tags", label: "Tags", type: "tags" },
  { key: "owner", label: "Assigned To", type: "ref:User" },
  { key: "course", label: "Course", type: "text" },
  { key: "grade", label: "Grade", type: "text" },
  { key: "priority", label: "Priority", type: "text" },
  { key: "value", label: "Value", type: "number" },
];

export const CONDITION_OPERATORS = [
  { key: "equals", label: "Equals", types: ["text", "number", "ref:*", "tags"] },
  { key: "not_equals", label: "Not Equals", types: ["text", "number", "ref:*"] },
  { key: "contains", label: "Contains", types: ["text", "tags"] },
  { key: "in", label: "Is One Of", types: ["ref:*", "tags"] },
  { key: "not_in", label: "Is Not One Of", types: ["ref:*", "tags"] },
  { key: "is_empty", label: "Is Empty", types: ["text", "ref:*", "tags"] },
  { key: "is_not_empty", label: "Is Not Empty", types: ["text", "ref:*", "tags"] },
  { key: "gt", label: "Greater Than", types: ["number"] },
  { key: "lt", label: "Less Than", types: ["number"] },
];

export const ACTION_TYPES = [
  { key: "whatsapp", label: "Send WhatsApp", params: ["template", "message"] },
  { key: "email", label: "Send Email", params: ["subject", "template"] },
  { key: "sms", label: "Send SMS", params: ["message"] },
  { key: "notify", label: "Notify the owner", params: ["message", "alsoManager"] },
  { key: "followup", label: "Create Follow-up", params: ["type", "note", "daysFromNow"] },
  { key: "status", label: "Change Status", params: ["statusId", "subStatusId"] },
  { key: "assign_lead", label: "Assign Lead", params: ["userId"] },
  { key: "tag", label: "Add Tag", params: ["tag"] },
  { key: "priority", label: "Set Priority", params: ["priority"] },
];

export const ASSIGNMENT_STRATEGIES = [
  { key: "round_robin", label: "Round Robin (within Team)", configType: "team" },
  { key: "source_wise_round_robin", label: "Source Wise Round Robin", configType: "source_map" },
  { key: "state_wise", label: "State Wise", configType: "state_map" },
  { key: "city_wise", label: "City Wise", configType: "city_map" },
  { key: "grade_wise", label: "Grade Wise", configType: "grade_map" },
];
