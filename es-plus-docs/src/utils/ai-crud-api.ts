/**
 * AI CRUD API - OpenAI-compatible API integration for real AI-powered config generation
 */

const SYSTEM_PROMPT = `You are an es-plus-ui configuration generator. Given a natural language description of a CRUD page, generate the complete configuration as a JSON object.

es-plus-ui is a Vue 3 + Element Plus config-driven component library. It uses JSON configuration to generate forms, tables, and dialogs.

## Output Format

Return a JSON object with these fields:
{
  "formItems": [...],     // Query form fields
  "columns": [...],       // Table columns
  "queryBtns": [...],     // Form action buttons
  "tableOptions": {...},  // Table options
  "actions": [...],       // Supported operations
  "dialogFormItems": [...] // Dialog form fields (for add/edit)
}

## FormItem Schema
{
  "prop": "fieldName",           // Required: field name
  "label": "Display Label",      // Required: label text
  "formtype": "Input",           // One of: Input, Select, datePicker, timePicker, Switch, Rate, Cascader, Radio, Checkbox, Upload, Slider, ColorPicker, Transfer
  "span": 6,                     // Grid span (1-24), default 6
  "attrs": {},                   // Element Plus component props
  "dataOptions": [{"label":"", "value":""}]  // For Select/Radio/Checkbox
}

## TableColumn Schema
{
  "prop": "fieldName",
  "label": "Column Header",
  "width": 120,                  // Optional
  "align": "center"              // Optional
}

## BtnConfig Schema
{
  "name": "Button Text",
  "type": "primary",             // primary/success/warning/danger/info
  "key": "query",                // Special: 'query' triggers search, 'rest' resets form
  "triggerEvent": true           // Auto-trigger form-table linkage
}

## Rules
- Use Chinese labels for Chinese input, English for English input
- formtype for date fields: "datePicker" with attrs: { type: "daterange", valueFormat: "YYYY-MM-DD" }
- formtype for status/category fields: "Select" with appropriate dataOptions
- Always include query (triggerEvent:true) and reset buttons
- Add operation column with btns array if actions include edit/delete
- prop names should be camelCase English
- Return ONLY valid JSON, no markdown formatting`

export interface AiConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
}

export async function generateWithAI(prompt: string, config: AiConfig): Promise<any> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API request failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from AI')
  }

  return JSON.parse(content)
}
