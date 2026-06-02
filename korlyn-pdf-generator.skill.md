# Antigravity Skill: Korlyn PDF Document Generator

This skill enables Antigravity to act as a document designer and content writer, generating structured JSON files that are automatically visualized, edited, and compiled into PDFs via the **Korlyn PDF Editor**.

---

## 1. Skill Metadata
* **Name:** Korlyn PDF Document Generator
* **Description:** Generates structured PDF document configurations matching the Korlyn JSON Schema.
* **Outputs:** Writes a `.json` configuration to the workspace, providing a local server link for editing/compilation.

---

## 2. Execution Instructions for the AI (Antigravity)

When the user requests you to generate a PDF, resume, invoice, brochure, or form:
1. **Analyze Requirements:** Determine pages, sections, copy, layout flow, and professional color scheme.
2. **Translate to Grid Layout:** Use the standard A4 coordinate space (**Width: 595pt, Height: 842pt**, with origin `(0, 0)` at the **top-left**).
3. **Generate JSON Configuration:** Create a JSON object matching the *Korlyn PDF Schema* (detailed below).
4. **Write File to Workspace:** Save the schema as a JSON file in the project folder:
   `C:/Users/Jovibe Code/antigravity-pdf-editor/<document-name>.json`
5. **Output Launch URL:** Respond with a clear explanation and the following clickable server link:
   `http://localhost:3000/?load=<document-name>.json`
   *(Also remind the user that they can drag and drop this JSON file directly into the workspace or copy/paste it).*

---

## 3. Korlyn PDF JSON Schema

The configuration file must follow this exact structure:

```json
{
  "pages": [
    {
      "id": "page_unique_timestamp_or_string",
      "elements": [
        {
          "id": "el_unique_id",
          "type": "text | rect | circle | image",
          "x": 40,
          "y": 40,
          "w": 200,
          "h": 30,
          "zIndex": 5,
          
          /* Only for type "text" */
          "text": "Hello World\nLine two text",
          "font": "Helvetica | Helvetica-Bold | Times-Roman | Times-Bold | Courier | Courier-Bold",
          "size": 12,
          "color": "#000000",
          "align": "left | center | right",
          
          /* Only for type "rect" or "circle" */
          "fill": "#e2e8f0",
          "stroke": "#4f46e5",
          "strokeWidth": 2,
          "fillTransparent": false,
          
          /* Only for type "image" */
          "src": "data:image/png;base64,...",
          "opacity": 100
        }
      ]
    }
  ]
}
```

### Design Coordinates & Grid Rules:
* **Margins:** Use standard `40` to `50` points margins (`x` from 40 to 555, `y` from 40 to 802).
* **Font Wraps:** Standardize text element widths (`w`). The live editor wraps text within this width.
* **Element Overlaps:** Adjust `zIndex` if you are overlaying text on shapes (e.g. shapes should have lower `zIndex` than texts).
* **Standard Colors:**
  * Clean Primary Accent: Indigo (`#6366f1` / `#4f46e5`)
  * Dark Slate Text: (`#0f172a` / `#1e293b`)
  * Neutral Gray Text: (`#64748b` / `#94a3b8`)
  * Border Grays: (`#cbd5e1` / `#e2e8f0`)

---

## 4. Example Prompts to Trigger This Skill

You can test this skill by asking the AI:
* *"Create a letter of recommendation for Sarah Connor in Korlyn PDF"*
* *"Generate an invoice template for a branding contract valued at $5000 in Korlyn PDF"*
* *"Build a single-page flyer schema for a Tech Conference happening on June 15th"*
