/* ==========================================================================
   KORLYN PDF EDITOR - CORE JAVASCRIPT
   State Management, Canvas Drag/Resize, Signature Pad, Templates & PDF-lib
   ========================================================================== */

(function () {
  // Destructure PDF-lib objects
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  // --- Constants ---
  const PAGE_WIDTH = 595;  // A4 Width in points/pixels
  const PAGE_HEIGHT = 842; // A4 Height in points/pixels
  
  // Self-contained 1x1 transparent/gray placeholder base64 PNG
  const PLACEHOLDER_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // --- Application State ---
  let state = {
    pages: [],
    selectedElementId: null,
    selectedPageId: null,
    zoom: 1.0,
    isSplitPreview: true
  };

  // Drag and Resize State
  let dragContext = {
    isDragging: false,
    isResizing: false,
    resizeType: null, // 'tl', 'tr', 'bl', 'br', 'tc', 'bc', 'lc', 'rc'
    startX: 0,
    startY: 0,
    startElementX: 0,
    startElementY: 0,
    startWidth: 0,
    startHeight: 0
  };

  // --- DOM Elements ---
  const elCanvasContainer = document.getElementById('canvas-container');
  const elPagesList = document.getElementById('pages-list');
  const elStatusText = document.getElementById('status-text');
  const elStatusDot = document.querySelector('.status-dot');
  
  // Action Buttons
  const btnClear = document.getElementById('btn-clear');
  const btnTogglePreview = document.getElementById('btn-toggle-preview');
  const btnDownload = document.getElementById('btn-download');
  const btnAddPage = document.getElementById('btn-add-page');
  const templateSelect = document.getElementById('template-select');
  
  // Zoom Controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const elZoomLevel = document.getElementById('zoom-level');
  
  // Toolbar Tools
  const toolText = document.getElementById('tool-text');
  const toolRect = document.getElementById('tool-rect');
  const toolCircle = document.getElementById('tool-circle');
  const toolImage = document.getElementById('tool-image');
  const toolSignature = document.getElementById('tool-signature');
  
  // Properties Panel Elements
  const propEmpty = document.getElementById('properties-empty');
  const propTextGroup = document.getElementById('prop-text-group');
  const propShapeGroup = document.getElementById('prop-shape-group');
  const propImageGroup = document.getElementById('prop-image-group');
  const propCommonGroup = document.getElementById('prop-common-group');
  
  const inputTxtContent = document.getElementById('prop-text-content');
  const selectTxtFont = document.getElementById('prop-text-font');
  const inputTxtSize = document.getElementById('prop-text-size');
  const inputTxtColor = document.getElementById('prop-text-color');
  const spanTxtColorHex = document.getElementById('text-color-hex');
  const selectTxtAlign = document.getElementById('prop-text-align');
  
  const inputShapeFill = document.getElementById('prop-shape-fill');
  const spanShapeFillHex = document.getElementById('shape-fill-hex');
  const checkShapeFillTransparent = document.getElementById('prop-shape-fill-transparent');
  const inputShapeStroke = document.getElementById('prop-shape-stroke');
  const spanShapeStrokeHex = document.getElementById('shape-stroke-hex');
  const inputShapeStrokeWidth = document.getElementById('prop-shape-stroke-width');
  
  const inputImgFile = document.getElementById('prop-image-file');
  const inputImgOpacity = document.getElementById('prop-image-opacity');
  const spanOpacityVal = document.getElementById('opacity-val');
  
  const inputPosX = document.getElementById('prop-pos-x');
  const inputPosY = document.getElementById('prop-pos-y');
  const inputSizeW = document.getElementById('prop-size-w');
  const inputSizeH = document.getElementById('prop-size-h');
  const btnDeleteElement = document.getElementById('btn-delete-element');
  
  // Live PDF Viewer Elements
  const elPdfPreviewFrame = document.getElementById('pdf-preview-frame');
  const elPdfLoading = document.getElementById('pdf-loading');
  const elApp = document.getElementById('app');

  // Signature Pad Modal Elements
  const modalSignature = document.getElementById('signature-modal');
  const canvasSig = document.getElementById('signature-canvas');
  const btnCloseSig = document.getElementById('btn-close-sig');
  const btnClearSig = document.getElementById('btn-clear-sig');
  const btnSaveSig = document.getElementById('btn-save-sig');
  const sigColors = document.querySelectorAll('.sig-colors .color-dot');
  
  // --- Signature Pad Logic ---
  let sigCtx = canvasSig.getContext('2d');
  let isDrawingSig = false;
  let activeSigColor = '#000000';

  // --- INITIALIZATION ---
  function init() {
    setupEventListeners();
    setupDragAndDrop();
    loadFromLocalStorage();
    
    // Check URL parameters for auto-loading config
    const params = new URLSearchParams(window.location.search);
    if (params.has('load')) {
      loadJsonFromUrl(params.get('load'));
    } else if (params.has('data')) {
      loadJsonFromBase64(params.get('data'));
    } else if (state.pages.length === 0) {
      loadTemplate('blank');
    } else {
      renderWorkspace();
      triggerCompile();
    }
  }

  // --- DRAG AND DROP SCHEMA LOADER ---
  function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, e => e.preventDefault(), false);
    });

    document.body.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length === 0) return;

      const file = files[0];
      if (file.type === "application/json" || file.name.endsWith('.json')) {
        setStatus('Reading dropped JSON...', 'yellow');
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const jsonData = JSON.parse(evt.target.result);
            loadJsonData(jsonData);
            setStatus('Dropped JSON loaded', 'green');
          } catch (err) {
            alert('Failed to parse dropped JSON file.');
            setStatus('Import Error', 'yellow');
          }
        };
        reader.readAsText(file);
      }
    }, false);
  }

  // --- JSON LOADING HELPERS ---
  function loadJsonFromUrl(url) {
    setStatus('Fetching schema...', 'yellow');
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(jsonData => {
        loadJsonData(jsonData);
        setStatus('Schema loaded from URL', 'green');
      })
      .catch(err => {
        console.error('Failed to load JSON from URL:', err);
        setStatus('Fetch Error', 'yellow');
        if (state.pages.length === 0) loadTemplate('blank');
      });
  }

  function loadJsonFromBase64(base64Str) {
    try {
      setStatus('Decoding schema...', 'yellow');
      const jsonStr = atob(base64Str);
      const jsonData = JSON.parse(jsonStr);
      loadJsonData(jsonData);
      setStatus('Schema loaded from URL data', 'green');
    } catch (err) {
      console.error('Failed to parse base64 JSON data:', err);
      setStatus('Decode Error', 'yellow');
      if (state.pages.length === 0) loadTemplate('blank');
    }
  }

  function loadJsonData(jsonData) {
    if (jsonData && Array.isArray(jsonData.pages)) {
      state.pages = jsonData.pages;
      state.selectedElementId = null;
      state.selectedPageId = state.pages[0] ? state.pages[0].id : null;
      saveToLocalStorage();
      renderWorkspace();
      triggerCompile();
    } else {
      alert('Invalid JSON structure. Needs a "pages" array.');
    }
  }

  // --- LOCAL STORAGE ---
  function saveToLocalStorage() {
    localStorage.setItem('korlyn_pdf_state', JSON.stringify({
      pages: state.pages,
      isSplitPreview: state.isSplitPreview
    }));
  }

  function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('korlyn_pdf_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.pages = parsed.pages || [];
        state.isSplitPreview = parsed.isSplitPreview !== undefined ? parsed.isSplitPreview : true;
        
        // Match toggle UI state
        if (state.isSplitPreview) {
          elApp.classList.add('split-preview');
          btnTogglePreview.classList.add('active');
        } else {
          elApp.classList.remove('split-preview');
          btnTogglePreview.classList.remove('active');
        }
      }
    } catch (e) {
      console.error("Failed to load local storage state:", e);
    }
  }

  // --- TEMPLATES LOADER ---
  function loadTemplate(type) {
    setStatus('Loading template...', 'yellow');
    state.pages = [];
    state.selectedElementId = null;
    state.selectedPageId = null;

    const pageId1 = 'page_' + Date.now();
    state.selectedPageId = pageId1;

    if (type === 'blank') {
      state.pages.push({
        id: pageId1,
        elements: []
      });
    } else if (type === 'invoice') {
      state.pages.push({
        id: pageId1,
        elements: [
          // Logo Holder
          { id: 'el_logo_bg', type: 'rect', x: 40, y: 40, w: 60, h: 60, fill: '#4f46e5', stroke: '#4f46e5', strokeWidth: 0, fillTransparent: false },
          { id: 'el_logo_txt', type: 'text', x: 40, y: 55, w: 60, h: 30, text: 'K', font: 'Helvetica-Bold', size: 24, color: '#ffffff', align: 'center' },
          { id: 'el_company_name', type: 'text', x: 110, y: 40, w: 200, h: 20, text: 'Korlyn Creative Agency', font: 'Helvetica-Bold', size: 14, color: '#0f172a', align: 'left' },
          { id: 'el_company_info', type: 'text', x: 110, y: 62, w: 200, h: 50, text: '123 Innovation Way, Suite 400\nhello@korlyn.design\nwww.korlyn.design', font: 'Helvetica', size: 9, color: '#64748b', align: 'left' },
          
          // Invoice Title
          { id: 'el_inv_title', type: 'text', x: 380, y: 40, w: 175, h: 30, text: 'INVOICE', font: 'Helvetica-Bold', size: 24, color: '#4f46e5', align: 'right' },
          { id: 'el_inv_meta', type: 'text', x: 380, y: 70, w: 175, h: 50, text: 'INVOICE NO: #INV-2026-089\nDATE: May 28, 2026\nDUE DATE: June 28, 2026', font: 'Helvetica', size: 9, color: '#64748b', align: 'right' },
          
          // Divider
          { id: 'el_div1', type: 'rect', x: 40, y: 130, w: 515, h: 1, fill: '#cbd5e1', stroke: '#cbd5e1', strokeWidth: 0, fillTransparent: false },
          
          // Billed To
          { id: 'el_bill_lbl', type: 'text', x: 40, y: 150, w: 150, h: 15, text: 'BILLED TO:', font: 'Helvetica-Bold', size: 10, color: '#64748b', align: 'left' },
          { id: 'el_bill_to', type: 'text', x: 40, y: 170, w: 220, h: 60, text: 'Acme Corporation\nAttn: Jane Doe\n456 Corporate Blvd, Metropolis\njane@acme.com', font: 'Helvetica', size: 10, color: '#0f172a', align: 'left' },
          
          // Payment Terms
          { id: 'el_pay_lbl', type: 'text', x: 380, y: 150, w: 175, h: 15, text: 'PAYMENT METHODS:', font: 'Helvetica-Bold', size: 10, color: '#64748b', align: 'right' },
          { id: 'el_pay_info', type: 'text', x: 380, y: 170, w: 175, h: 60, text: 'Bank of Innovation\nIBAN: US89 3704 0023 99\nSWIFT: INOVUS33', font: 'Helvetica', size: 10, color: '#0f172a', align: 'right' },
          
          // Table Headers
          { id: 'el_th_bg', type: 'rect', x: 40, y: 250, w: 515, h: 25, fill: '#f1f5f9', stroke: '#cbd5e1', strokeWidth: 1, fillTransparent: false },
          { id: 'el_th_desc', type: 'text', x: 50, y: 257, w: 250, h: 18, text: 'Description', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'left' },
          { id: 'el_th_qty', type: 'text', x: 310, y: 257, w: 50, h: 18, text: 'Hours', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'center' },
          { id: 'el_th_rate', type: 'text', x: 380, y: 257, w: 75, h: 18, text: 'Rate', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'right' },
          { id: 'el_th_amount', type: 'text', x: 470, y: 257, w: 75, h: 18, text: 'Amount', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'right' },
          
          // Line Item 1
          { id: 'el_item1_desc', type: 'text', x: 50, y: 285, w: 250, h: 30, text: 'Website Redesign & Frontend Development\nReact, Custom Design & Responsive integration', font: 'Helvetica', size: 9, color: '#0f172a', align: 'left' },
          { id: 'el_item1_qty', type: 'text', x: 310, y: 285, w: 50, h: 15, text: '40', font: 'Helvetica', size: 10, color: '#0f172a', align: 'center' },
          { id: 'el_item1_rate', type: 'text', x: 380, y: 285, w: 75, h: 15, text: '$150.00', font: 'Helvetica', size: 10, color: '#0f172a', align: 'right' },
          { id: 'el_item1_total', type: 'text', x: 470, y: 285, w: 75, h: 15, text: '$6,000.00', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'right' },
          { id: 'el_item1_div', type: 'rect', x: 40, y: 320, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },

          // Line Item 2
          { id: 'el_item2_desc', type: 'text', x: 50, y: 335, w: 250, h: 30, text: 'SEO & Brand Strategy Consultation\nMarket analysis and keyword indexing plan', font: 'Helvetica', size: 9, color: '#0f172a', align: 'left' },
          { id: 'el_item2_qty', type: 'text', x: 310, y: 335, w: 50, h: 15, text: '10', font: 'Helvetica', size: 10, color: '#0f172a', align: 'center' },
          { id: 'el_item2_rate', type: 'text', x: 380, y: 335, w: 75, h: 15, text: '$120.00', font: 'Helvetica', size: 10, color: '#0f172a', align: 'right' },
          { id: 'el_item2_total', type: 'text', x: 470, y: 335, w: 75, h: 15, text: '$1,200.00', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'right' },
          { id: 'el_item2_div', type: 'rect', x: 40, y: 370, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },

          // Total Calculation Area
          { id: 'el_sub_lbl', type: 'text', x: 350, y: 400, w: 100, h: 15, text: 'Subtotal:', font: 'Helvetica', size: 10, color: '#64748b', align: 'right' },
          { id: 'el_sub_val', type: 'text', x: 470, y: 400, w: 75, h: 15, text: '$7,200.00', font: 'Helvetica', size: 10, color: '#0f172a', align: 'right' },
          
          { id: 'el_tax_lbl', type: 'text', x: 350, y: 420, w: 100, h: 15, text: 'Tax (10%):', font: 'Helvetica', size: 10, color: '#64748b', align: 'right' },
          { id: 'el_tax_val', type: 'text', x: 470, y: 420, w: 75, h: 15, text: '$720.00', font: 'Helvetica', size: 10, color: '#0f172a', align: 'right' },
          
          { id: 'el_tot_bg', type: 'rect', x: 340, y: 440, w: 215, h: 30, fill: '#4f46e5', stroke: '#4f46e5', strokeWidth: 0, fillTransparent: false },
          { id: 'el_tot_lbl', type: 'text', x: 350, y: 449, w: 100, h: 15, text: 'Total Due (USD):', font: 'Helvetica-Bold', size: 11, color: '#ffffff', align: 'right' },
          { id: 'el_tot_val', type: 'text', x: 470, y: 449, w: 75, h: 15, text: '$7,920.00', font: 'Helvetica-Bold', size: 11, color: '#ffffff', align: 'right' },
          
          // Sign-off
          { id: 'el_sign_line', type: 'rect', x: 40, y: 550, w: 150, h: 1, fill: '#64748b', stroke: '#64748b', strokeWidth: 0, fillTransparent: false },
          { id: 'el_sign_lbl', type: 'text', x: 40, y: 558, w: 150, h: 15, text: 'Authorized Signature', font: 'Helvetica', size: 9, color: '#64748b', align: 'center' },
          
          // Bottom Terms
          { id: 'el_terms_lbl', type: 'text', x: 40, y: 720, w: 515, h: 15, text: 'TERMS & CONDITIONS', font: 'Helvetica-Bold', size: 9, color: '#0f172a', align: 'left' },
          { id: 'el_terms_txt', type: 'text', x: 40, y: 740, w: 515, h: 40, text: 'Payment is due within 30 days of invoice date. Please mention invoice number #INV-2026-089 as reference on your bank remittance. Thank you for your continued partnership with Korlyn.', font: 'Helvetica', size: 8, color: '#64748b', align: 'left' }
        ]
      });
    } else if (type === 'resume') {
      state.pages.push({
        id: pageId1,
        elements: [
          // Header Accent Band
          { id: 'el_res_band', type: 'rect', x: 0, y: 0, w: 595, h: 12, fill: '#6366f1', stroke: '#6366f1', strokeWidth: 0, fillTransparent: false },
          
          // Name and Contact
          { id: 'el_res_name', type: 'text', x: 40, y: 40, w: 515, h: 32, text: 'ALEXANDER MERCER', font: 'Helvetica-Bold', size: 24, color: '#0f172a', align: 'center' },
          { id: 'el_res_title', type: 'text', x: 40, y: 72, w: 515, h: 18, text: 'Lead Full Stack Engineer', font: 'Helvetica-Bold', size: 12, color: '#6366f1', align: 'center' },
          { id: 'el_res_contact', type: 'text', x: 40, y: 92, w: 515, h: 15, text: 'alex.mercer@email.com   |   +1 (555) 019-2834   |   San Francisco, CA   |   github.com/alexmercer', font: 'Helvetica', size: 9, color: '#64748b', align: 'center' },
          
          // Profile Section
          { id: 'el_res_sec1_title', type: 'text', x: 40, y: 130, w: 515, h: 15, text: 'PROFESSIONAL SUMMARY', font: 'Helvetica-Bold', size: 11, color: '#6366f1', align: 'left' },
          { id: 'el_res_sec1_line', type: 'rect', x: 40, y: 147, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },
          { id: 'el_res_sec1_body', type: 'text', x: 40, y: 155, w: 515, h: 50, text: 'Innovative and results-driven Lead Full Stack Engineer with 8+ years of experience designing, building, and deploying highly scalable cloud applications. Expert in React, Node.js, TypeScript, PostgreSQL, and cloud-native architectures. Passionate about engineering UI performance and document generation workflows.', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' },
          
          // Experience Section
          { id: 'el_res_sec2_title', type: 'text', x: 40, y: 220, w: 515, h: 15, text: 'PROFESSIONAL EXPERIENCE', font: 'Helvetica-Bold', size: 11, color: '#6366f1', align: 'left' },
          { id: 'el_res_sec2_line', type: 'rect', x: 40, y: 237, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },
          
          // Job 1
          { id: 'el_res_j1_title', type: 'text', x: 40, y: 247, w: 350, h: 15, text: 'Senior Software Engineer — TechCorp', font: 'Helvetica-Bold', size: 10.5, color: '#0f172a', align: 'left' },
          { id: 'el_res_j1_dates', type: 'text', x: 400, y: 247, w: 155, h: 15, text: '2022 - Present', font: 'Helvetica-Bold', size: 10, color: '#64748b', align: 'right' },
          { id: 'el_res_j1_bullets', type: 'text', x: 40, y: 265, w: 515, h: 80, text: '• Led a team of 6 engineers to redesign the core e-commerce dashboard, improving performance by 40%.\n• Designed and implemented serverless backend API integrations processing 1M+ daily transactions.\n• Championed adopting TypeScript and automated testing, reducing production critical bugs by 25%.\n• Architected a real-time analytics engine utilizing WebSockets and Node.js microservices.', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' },
          
          // Job 2
          { id: 'el_res_j2_title', type: 'text', x: 40, y: 355, w: 350, h: 15, text: 'Full Stack Developer — DevStudio', font: 'Helvetica-Bold', size: 10.5, color: '#0f172a', align: 'left' },
          { id: 'el_res_j2_dates', type: 'text', x: 400, y: 355, w: 155, h: 15, text: '2018 - 2022', font: 'Helvetica-Bold', size: 10, color: '#64748b', align: 'right' },
          { id: 'el_res_j2_bullets', type: 'text', x: 40, y: 373, w: 515, h: 70, text: '• Built and launched 12 client web projects using React, Node.js, Express, and PostgreSQL.\n• Integrated multiple third-party API gateways (Stripe, Twilio, SendGrid) with zero-downtime migrations.\n• Optimized database query index structures, reducing slow queries response time by 50%.\n• Deployed containerized applications using Docker and AWS Elastic Beanstalk.', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' },
          
          // Education Section
          { id: 'el_res_sec3_title', type: 'text', x: 40, y: 460, w: 515, h: 15, text: 'EDUCATION', font: 'Helvetica-Bold', size: 11, color: '#6366f1', align: 'left' },
          { id: 'el_res_sec3_line', type: 'rect', x: 40, y: 477, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },
          { id: 'el_res_edu_title', type: 'text', x: 40, y: 487, w: 350, h: 15, text: 'B.S. in Computer Science — Stanford University', font: 'Helvetica-Bold', size: 10, color: '#0f172a', align: 'left' },
          { id: 'el_res_edu_dates', type: 'text', x: 400, y: 487, w: 155, h: 15, text: 'Graduated 2018', font: 'Helvetica-Bold', size: 10, color: '#64748b', align: 'right' },
          
          // Skills Section
          { id: 'el_res_sec4_title', type: 'text', x: 40, y: 520, w: 515, h: 15, text: 'TECHNICAL SKILLS & COMPETENCIES', font: 'Helvetica-Bold', size: 11, color: '#6366f1', align: 'left' },
          { id: 'el_res_sec4_line', type: 'rect', x: 40, y: 537, w: 515, h: 1, fill: '#e2e8f0', stroke: '#e2e8f0', strokeWidth: 0, fillTransparent: false },
          
          { id: 'el_res_sk_t1', type: 'text', x: 40, y: 547, w: 120, h: 15, text: 'Languages & Core:', font: 'Helvetica-Bold', size: 9.5, color: '#0f172a', align: 'left' },
          { id: 'el_res_sk_v1', type: 'text', x: 160, y: 547, w: 395, h: 15, text: 'JavaScript (ES6+), TypeScript, Python, HTML5, CSS3, SQL, Go', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' },
          
          { id: 'el_res_sk_t2', type: 'text', x: 40, y: 567, w: 120, h: 15, text: 'Frameworks & Libs:', font: 'Helvetica-Bold', size: 9.5, color: '#0f172a', align: 'left' },
          { id: 'el_res_sk_v2', type: 'text', x: 160, y: 567, w: 395, h: 15, text: 'React, Next.js, Angular, Node.js, Express, Redux Toolkit, TailwindCSS', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' },
          
          { id: 'el_res_sk_t3', type: 'text', x: 40, y: 587, w: 120, h: 15, text: 'Databases & Tools:', font: 'Helvetica-Bold', size: 9.5, color: '#0f172a', align: 'left' },
          { id: 'el_res_sk_v3', type: 'text', x: 160, y: 587, w: 395, h: 15, text: 'PostgreSQL, MongoDB, Redis, Docker, Git, AWS (S3/EC2/Lambda), Vite', font: 'Helvetica', size: 9.5, color: '#334155', align: 'left' }
        ]
      });
    } else if (type === 'letter') {
      state.pages.push({
        id: pageId1,
        elements: [
          // Letter Header
          { id: 'el_let_logo', type: 'text', x: 40, y: 40, w: 300, h: 24, text: 'KORLYN DESIGNS', font: 'Helvetica-Bold', size: 16, color: '#6366f1', align: 'left' },
          { id: 'el_let_addr', type: 'text', x: 40, y: 62, w: 300, h: 40, text: '123 Creative Street, Suite 2A\nSan Francisco, CA 94107\nwww.korlyndesigns.com', font: 'Helvetica', size: 9, color: '#64748b', align: 'left' },
          
          // Date
          { id: 'el_let_date', type: 'text', x: 40, y: 120, w: 200, h: 15, text: 'May 28, 2026', font: 'Helvetica', size: 10, color: '#0f172a', align: 'left' },
          
          // Recipient Address
          { id: 'el_let_recipient', type: 'text', x: 40, y: 160, w: 300, h: 60, text: 'Attn: Hiring Department\nGlobal Technology Solutions\n987 Enterprise Parkway, Suite 10\nAustin, TX 78701', font: 'Helvetica', size: 10, color: '#334155', align: 'left' },
          
          // Subject
          { id: 'el_let_subject', type: 'text', x: 40, y: 240, w: 515, h: 20, text: 'Subject: Application for Senior Full-Stack Developer position', font: 'Helvetica-Bold', size: 11, color: '#0f172a', align: 'left' },
          
          // Salutation
          { id: 'el_let_salute', type: 'text', x: 40, y: 280, w: 300, h: 15, text: 'Dear Hiring Committee,', font: 'Helvetica', size: 10, color: '#0f172a', align: 'left' },
          
          // Body Paragraphs
          { id: 'el_let_body1', type: 'text', x: 40, y: 310, w: 515, h: 100, text: 'I am writing to express my eager interest in the Senior Full-Stack Developer position advertised on your careers page. With over eight years of hands-on experience developing enterprise web applications, maintaining high-frequency REST APIs, and implementing automated testing structures, I am confident I will make an immediate impact on your product roadmap.', font: 'Helvetica', size: 10, color: '#334155', align: 'left' },
          
          { id: 'el_let_body2', type: 'text', x: 40, y: 400, w: 515, h: 100, text: 'In my current role as Senior Software Engineer at TechCorp, I led the successful migration of our core catalog services to a serverless AWS infrastructure, reducing hosting costs by 30% while increasing query efficiency. I specialize in driving collaboration across cross-functional teams and implementing UI standards that focus heavily on accessible user experiences.', font: 'Helvetica', size: 10, color: '#334155', align: 'left' },
          
          { id: 'el_let_body3', type: 'text', x: 40, y: 490, w: 515, h: 80, text: 'I welcome the opportunity to discuss my application further. Thank you for your time, consideration, and dedication to building tools that advance user creativity. I look forward to hearing from you.', font: 'Helvetica', size: 10, color: '#334155', align: 'left' },
          
          // Sign off
          { id: 'el_let_close', type: 'text', x: 40, y: 590, w: 200, h: 100, text: 'Sincerely,\n\n\n\nAlexander Mercer\nLead Full Stack Engineer', font: 'Helvetica', size: 10, color: '#334155', align: 'left' }
        ]
      });
    }

    saveToLocalStorage();
    renderWorkspace();
    triggerCompile();
  }

  // --- WORKSPACE RENDERING ---
  function renderWorkspace() {
    elCanvasContainer.innerHTML = '';
    
    state.pages.forEach((page, index) => {
      // Create page element wrapper
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.id = page.id;
      pageDiv.setAttribute('data-page-index', index);
      
      // Page Selection Click
      pageDiv.addEventListener('mousedown', (e) => {
        // If clicking blank page area, select page and deselect element
        if (e.target === pageDiv) {
          selectElement(null);
          state.selectedPageId = page.id;
          updatePageUIHighlight();
        }
      });

      // Render elements on page
      page.elements.forEach(el => {
        const elDiv = createVisualElement(el, page.id);
        pageDiv.appendChild(elDiv);
      });

      elCanvasContainer.appendChild(pageDiv);
    });

    renderPagesSidebar();
    updatePageUIHighlight();
    updatePropertiesPanel();
  }

  function renderPagesSidebar() {
    elPagesList.innerHTML = '';
    state.pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = 'pages-list-item' + (state.selectedPageId === page.id ? ' active' : '');
      item.innerHTML = `
        <span>Page ${index + 1}</span>
        ${state.pages.length > 1 ? `
          <svg class="delete-page-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" data-page-id="${page.id}">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        ` : ''}
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-page-icon') || e.target.closest('.delete-page-icon')) {
          const pageId = e.target.getAttribute('data-page-id') || e.target.closest('.delete-page-icon').getAttribute('data-page-id');
          deletePage(pageId);
        } else {
          state.selectedPageId = page.id;
          selectElement(null);
          updatePageUIHighlight();
          // Scroll page into view
          const el = document.getElementById(page.id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      elPagesList.appendChild(item);
    });
  }

  function updatePageUIHighlight() {
    document.querySelectorAll('.pdf-page').forEach(el => {
      if (el.id === state.selectedPageId) {
        el.style.boxShadow = '0 0 0 3px var(--accent), var(--shadow-paper)';
      } else {
        el.style.boxShadow = 'var(--shadow-paper)';
      }
    });

    document.querySelectorAll('.pages-list-item').forEach((el, index) => {
      if (state.pages[index] && state.pages[index].id === state.selectedPageId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // --- ELEMENT RENDERING ON CANVAS ---
  function createVisualElement(el, pageId) {
    const div = document.createElement('div');
    div.className = 'pdf-element';
    div.id = 'dom_' + el.id;
    div.style.left = el.x + 'px';
    div.style.top = el.y + 'px';
    div.style.width = el.w + 'px';
    div.style.height = el.h + 'px';
    div.style.zIndex = el.zIndex || 5;

    if (state.selectedElementId === el.id) {
      div.classList.add('selected');
    }

    // Set inside content based on type
    if (el.type === 'text') {
      const inner = document.createElement('div');
      inner.className = 'pdf-element-text';
      inner.innerText = el.text;
      inner.style.fontFamily = getFontFamilyStyle(el.font);
      inner.style.fontSize = el.size + 'px';
      inner.style.color = el.color;
      inner.style.textAlign = el.align;
      // Handle simple styling
      if (el.font.includes('Bold')) inner.style.fontWeight = 'bold';
      if (el.font.includes('Oblique') || el.font.includes('Italic')) inner.style.fontStyle = 'italic';
      
      div.appendChild(inner);
    } else if (el.type === 'rect') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'pdf-element-shape');
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', el.fillTransparent ? 'transparent' : el.fill);
      rect.setAttribute('stroke', el.strokeWidth > 0 ? el.stroke : 'transparent');
      rect.setAttribute('stroke-width', el.strokeWidth);
      
      svg.appendChild(rect);
      div.appendChild(svg);
    } else if (el.type === 'circle') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'pdf-element-shape');
      
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellipse.setAttribute('cx', '50%');
      ellipse.setAttribute('cy', '50%');
      ellipse.setAttribute('rx', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
      ellipse.setAttribute('ry', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
      ellipse.setAttribute('fill', el.fillTransparent ? 'transparent' : el.fill);
      ellipse.setAttribute('stroke', el.strokeWidth > 0 ? el.stroke : 'transparent');
      ellipse.setAttribute('stroke-width', el.strokeWidth);
      
      svg.appendChild(ellipse);
      div.appendChild(svg);
    } else if (el.type === 'image' || el.type === 'signature') {
      const img = document.createElement('img');
      img.className = 'pdf-element-image';
      img.src = el.src || PLACEHOLDER_PNG;
      img.style.opacity = (el.opacity !== undefined ? el.opacity : 100) / 100;
      
      div.appendChild(img);
    }

    // Attach resize handles
    const handles = ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'lc', 'rc'];
    handles.forEach(type => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${type}`;
      handle.setAttribute('data-handle', type);
      div.appendChild(handle);
    });

    // Mousedown handling for Select / Drag / Resize
    div.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.selectedPageId = pageId;
      selectElement(el.id);
      
      const targetHandle = e.target.getAttribute('data-handle');
      
      dragContext.isDragging = !targetHandle;
      dragContext.isResizing = !!targetHandle;
      dragContext.resizeType = targetHandle;
      dragContext.startX = e.clientX;
      dragContext.startY = e.clientY;
      dragContext.startElementX = el.x;
      dragContext.startElementY = el.y;
      dragContext.startWidth = el.w;
      dragContext.startHeight = el.h;
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    return div;
  }

  // Font mapping helpers for DOM display
  function getFontFamilyStyle(pdfFont) {
    if (pdfFont.includes('Times')) return '"Playfair Display", "Times New Roman", Times, serif';
    if (pdfFont.includes('Courier')) return '"Courier New", Courier, monospace';
    return '"Inter", sans-serif';
  }

  // --- INTERACTIVE DRAG & RESIZE ---
  function onMouseMove(e) {
    const el = getSelectedElement();
    if (!el) return;

    // Adjust movement using zoom multiplier
    const dx = Math.round((e.clientX - dragContext.startX) / state.zoom);
    const dy = Math.round((e.clientY - dragContext.startY) / state.zoom);

    if (dragContext.isDragging) {
      el.x = Math.max(0, Math.min(PAGE_WIDTH - el.w, dragContext.startElementX + dx));
      el.y = Math.max(0, Math.min(PAGE_HEIGHT - el.h, dragContext.startElementY + dy));
      
      updateDomPosition(el);
    } else if (dragContext.isResizing) {
      const type = dragContext.resizeType;
      let newW = el.w;
      let newH = el.h;
      let newX = el.x;
      let newY = el.y;

      const minSize = 12;

      // Handle horizontal adjustments
      if (type.includes('r')) {
        newW = Math.max(minSize, dragContext.startWidth + dx);
        newW = Math.min(PAGE_WIDTH - el.x, newW);
      } else if (type.includes('l')) {
        const potentialW = dragContext.startWidth - dx;
        if (potentialW >= minSize) {
          newW = potentialW;
          newX = Math.max(0, dragContext.startElementX + dx);
        }
      }

      // Handle vertical adjustments
      if (type.includes('b')) {
        newH = Math.max(minSize, dragContext.startHeight + dy);
        newH = Math.min(PAGE_HEIGHT - el.y, newH);
      } else if (type.includes('t')) {
        const potentialH = dragContext.startHeight - dy;
        if (potentialH >= minSize) {
          newH = potentialH;
          newY = Math.max(0, dragContext.startElementY + dy);
        }
      }

      el.w = Math.round(newW);
      el.h = Math.round(newH);
      el.x = Math.round(newX);
      el.y = Math.round(newY);

      updateDomPosition(el);
    }

    updatePropertiesInputs(el);
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    dragContext.isDragging = false;
    dragContext.isResizing = false;
    dragContext.resizeType = null;
    
    saveToLocalStorage();
    triggerCompile();
  }

  function updateDomPosition(el) {
    const dom = document.getElementById('dom_' + el.id);
    if (!dom) return;

    dom.style.left = el.x + 'px';
    dom.style.top = el.y + 'px';
    dom.style.width = el.w + 'px';
    dom.style.height = el.h + 'px';

    // Redraw SVG outlines if shape to prevent distortion
    if (el.type === 'rect' || el.type === 'circle') {
      const svg = dom.querySelector('.pdf-element-shape');
      if (svg) {
        if (el.type === 'circle') {
          const ellipse = svg.querySelector('ellipse');
          if (ellipse) {
            ellipse.setAttribute('rx', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
            ellipse.setAttribute('ry', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
          }
        }
      }
    }
  }

  // --- SELECTION CONTROL ---
  function selectElement(id) {
    if (state.selectedElementId === id) return;
    
    // Clear old active selection
    if (state.selectedElementId) {
      const activeDom = document.getElementById('dom_' + state.selectedElementId);
      if (activeDom) activeDom.classList.remove('selected');
    }

    state.selectedElementId = id;
    
    if (id) {
      const newActiveDom = document.getElementById('dom_' + id);
      if (newActiveDom) newActiveDom.classList.add('selected');
    }

    updatePropertiesPanel();
  }

  function getSelectedElement() {
    if (!state.selectedElementId || !state.selectedPageId) return null;
    const page = state.pages.find(p => p.id === state.selectedPageId);
    if (!page) return null;
    return page.elements.find(e => e.id === state.selectedElementId);
  }

  // --- PROPERTIES EDITOR SYNCHRONIZATIONS ---
  function updatePropertiesPanel() {
    const el = getSelectedElement();

    if (!el) {
      propEmpty.classList.remove('hidden');
      propTextGroup.classList.add('hidden');
      propShapeGroup.classList.add('hidden');
      propImageGroup.classList.add('hidden');
      propCommonGroup.classList.add('hidden');
      return;
    }

    propEmpty.classList.add('hidden');
    propCommonGroup.classList.remove('hidden');

    // Toggle specific controls
    if (el.type === 'text') {
      propTextGroup.classList.remove('hidden');
      propShapeGroup.classList.add('hidden');
      propImageGroup.classList.add('hidden');
      
      inputTxtContent.value = el.text;
      selectTxtFont.value = el.font;
      inputTxtSize.value = el.size;
      inputTxtColor.value = el.color;
      spanTxtColorHex.innerText = el.color.toUpperCase();
      selectTxtAlign.value = el.align || 'left';
    } else if (el.type === 'rect' || el.type === 'circle') {
      propTextGroup.classList.add('hidden');
      propShapeGroup.classList.remove('hidden');
      propImageGroup.classList.add('hidden');
      
      inputShapeFill.value = el.fill;
      spanShapeFillHex.innerText = el.fill.toUpperCase();
      checkShapeFillTransparent.checked = !!el.fillTransparent;
      inputShapeStroke.value = el.stroke;
      spanShapeStrokeHex.innerText = el.stroke.toUpperCase();
      inputShapeStrokeWidth.value = el.strokeWidth;
      
      inputShapeFill.disabled = !!el.fillTransparent;
    } else if (el.type === 'image' || el.type === 'signature') {
      propTextGroup.classList.add('hidden');
      propShapeGroup.classList.add('hidden');
      propImageGroup.classList.remove('hidden');
      
      // Hide manual file upload option for digital signature pad elements
      const fileUploadRow = document.getElementById('image-upload-row');
      if (el.type === 'signature') {
        fileUploadRow.classList.add('hidden');
      } else {
        fileUploadRow.classList.remove('hidden');
      }
      
      inputImgOpacity.value = el.opacity !== undefined ? el.opacity : 100;
      spanOpacityVal.innerText = (el.opacity !== undefined ? el.opacity : 100) + '%';
    }

    updatePropertiesInputs(el);
  }

  function updatePropertiesInputs(el) {
    inputPosX.value = el.x;
    inputPosY.value = el.y;
    inputSizeW.value = el.w;
    inputSizeH.value = el.h;
  }

  // Listen to input changes in the Properties Sidebar
  function setupEventListeners() {
    
    // Reset Canvas Action
    btnClear.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset the canvas? All elements will be deleted.')) {
        loadTemplate('blank');
      }
    });

    // Toggle Preview Action
    btnTogglePreview.addEventListener('click', () => {
      state.isSplitPreview = !state.isSplitPreview;
      if (state.isSplitPreview) {
        elApp.classList.add('split-preview');
        btnTogglePreview.classList.add('active');
        triggerCompile();
      } else {
        elApp.classList.remove('split-preview');
        btnTogglePreview.classList.remove('active');
      }
      saveToLocalStorage();
    });

    // Add Page Action
    btnAddPage.addEventListener('click', () => {
      const pageId = 'page_' + Date.now();
      state.pages.push({
        id: pageId,
        elements: []
      });
      state.selectedPageId = pageId;
      selectElement(null);
      saveToLocalStorage();
      renderWorkspace();
      triggerCompile();
      
      // Scroll page into view
      setTimeout(() => {
        const el = document.getElementById(pageId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });

    // Choose Template
    templateSelect.addEventListener('change', (e) => {
      loadTemplate(e.target.value);
    });

    // Export PDF Download
    btnDownload.addEventListener('click', () => {
      compilePDF(true);
    });

    // Zoom Controls
    btnZoomIn.addEventListener('click', () => {
      state.zoom = Math.min(2.0, state.zoom + 0.1);
      applyZoom();
    });
    btnZoomOut.addEventListener('click', () => {
      state.zoom = Math.max(0.5, state.zoom - 0.1);
      applyZoom();
    });

    // Tool click - Create Elements
    toolText.addEventListener('click', () => createElementOnActivePage('text'));
    toolRect.addEventListener('click', () => createElementOnActivePage('rect'));
    toolCircle.addEventListener('click', () => createElementOnActivePage('circle'));
    toolImage.addEventListener('click', () => createElementOnActivePage('image'));
    toolSignature.addEventListener('click', openSignatureModal);

    // JSON Import/Export button listeners
    const btnImportJson = document.getElementById('btn-import-json');
    const btnExportJson = document.getElementById('btn-export-json');

    btnImportJson.addEventListener('click', () => {
      const pasted = prompt('Paste the Korlyn PDF JSON configuration here:');
      if (!pasted) return;
      try {
        const parsed = JSON.parse(pasted);
        loadJsonData(parsed);
        setStatus('JSON Schema imported successfully', 'green');
      } catch (err) {
        alert('Invalid JSON formatting. Please check the schema.');
      }
    });

    btnExportJson.addEventListener('click', () => {
      const exportState = {
        pages: state.pages.map(page => ({
          id: page.id,
          elements: page.elements.map(el => {
            const cleanEl = { ...el };
            return cleanEl;
          })
        }))
      };
      const jsonStr = JSON.stringify(exportState, null, 2);
      
      navigator.clipboard.writeText(jsonStr)
        .then(() => {
          setStatus('Schema copied to clipboard', 'green');
          alert('JSON Schema copied to clipboard!');
        })
        .catch(err => {
          const textarea = document.createElement('textarea');
          textarea.value = jsonStr;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setStatus('Schema copied to clipboard (fallback)', 'green');
          alert('JSON Schema copied to clipboard (fallback)!');
        });
    });

    // Properties input changes
    inputTxtContent.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && el.type === 'text') {
        el.text = e.target.value;
        updateTextElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    selectTxtFont.addEventListener('change', (e) => {
      const el = getSelectedElement();
      if (el && el.type === 'text') {
        el.font = e.target.value;
        updateTextElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    inputTxtSize.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && el.type === 'text') {
        el.size = parseInt(e.target.value) || 12;
        updateTextElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    inputTxtColor.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && el.type === 'text') {
        el.color = e.target.value;
        spanTxtColorHex.innerText = el.color.toUpperCase();
        updateTextElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    selectTxtAlign.addEventListener('change', (e) => {
      const el = getSelectedElement();
      if (el && el.type === 'text') {
        el.align = e.target.value;
        updateTextElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    // Shape properties bindings
    inputShapeFill.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && (el.type === 'rect' || el.type === 'circle')) {
        el.fill = e.target.value;
        spanShapeFillHex.innerText = el.fill.toUpperCase();
        updateShapeElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    checkShapeFillTransparent.addEventListener('change', (e) => {
      const el = getSelectedElement();
      if (el && (el.type === 'rect' || el.type === 'circle')) {
        el.fillTransparent = e.target.checked;
        inputShapeFill.disabled = e.target.checked;
        updateShapeElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    inputShapeStroke.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && (el.type === 'rect' || el.type === 'circle')) {
        el.stroke = e.target.value;
        spanShapeStrokeHex.innerText = el.stroke.toUpperCase();
        updateShapeElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    inputShapeStrokeWidth.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && (el.type === 'rect' || el.type === 'circle')) {
        el.strokeWidth = parseInt(e.target.value) || 0;
        updateShapeElementDOM(el);
        triggerCompile();
        saveToLocalStorage();
      }
    });

    // Image properties bindings
    inputImgFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        const el = getSelectedElement();
        if (el && el.type === 'image') {
          el.src = event.target.result;
          const domImg = document.querySelector('#dom_' + el.id + ' img');
          if (domImg) domImg.src = el.src;
          triggerCompile();
          saveToLocalStorage();
        }
      };
      reader.readAsDataURL(file);
    });

    inputImgOpacity.addEventListener('input', (e) => {
      const el = getSelectedElement();
      if (el && (el.type === 'image' || el.type === 'signature')) {
        el.opacity = parseInt(e.target.value);
        spanOpacityVal.innerText = el.opacity + '%';
        const domImg = document.querySelector('#dom_' + el.id + ' img');
        if (domImg) domImg.style.opacity = el.opacity / 100;
        triggerCompile();
        saveToLocalStorage();
      }
    });

    // Layout position/dimension manual input adjustments
    inputPosX.addEventListener('input', (e) => handleManualLayoutChange('x', e.target.value));
    inputPosY.addEventListener('input', (e) => handleManualLayoutChange('y', e.target.value));
    inputSizeW.addEventListener('input', (e) => handleManualLayoutChange('w', e.target.value));
    inputSizeH.addEventListener('input', (e) => handleManualLayoutChange('h', e.target.value));

    // Delete Button action
    btnDeleteElement.addEventListener('click', () => {
      const el = getSelectedElement();
      if (el) deleteElement(el.id);
    });

    // Signature pad draw event handling
    canvasSig.addEventListener('mousedown', startDrawingSignature);
    canvasSig.addEventListener('mousemove', drawSignature);
    canvasSig.addEventListener('mouseup', stopDrawingSignature);
    canvasSig.addEventListener('mouseleave', stopDrawingSignature);

    canvasSig.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvasSig.getBoundingClientRect();
      sigCtx.beginPath();
      sigCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
      isDrawingSig = true;
    });
    canvasSig.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawingSig) return;
      const touch = e.touches[0];
      const rect = canvasSig.getBoundingClientRect();
      sigCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      sigCtx.strokeStyle = activeSigColor;
      sigCtx.lineWidth = 3;
      sigCtx.lineCap = 'round';
      sigCtx.lineJoin = 'round';
      sigCtx.stroke();
    });
    canvasSig.addEventListener('touchend', () => isDrawingSig = false);

    btnCloseSig.addEventListener('click', closeSignatureModal);
    btnClearSig.addEventListener('click', clearSignatureCanvas);
    btnSaveSig.addEventListener('click', saveSignatureToCanvas);

    sigColors.forEach(dot => {
      dot.addEventListener('click', (e) => {
        sigColors.forEach(d => d.classList.remove('active'));
        e.target.classList.add('active');
        activeSigColor = e.target.getAttribute('data-color');
      });
    });

    // Global keyboard listeners
    document.addEventListener('keydown', (e) => {
      // Allow delete key to remove active selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedElementId) {
        // Ensure user is not currently typing in properties input
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          deleteElement(state.selectedElementId);
        }
      }
    });
  }

  function handleManualLayoutChange(prop, val) {
    const el = getSelectedElement();
    if (!el) return;

    let numVal = parseInt(val) || 0;
    if (prop === 'w' || prop === 'h') {
      numVal = Math.max(12, numVal);
    }
    el[prop] = numVal;
    
    updateDomPosition(el);
    triggerCompile();
    saveToLocalStorage();
  }

  // --- ELEMENT UPDATE DOM REDRAWS ---
  function updateTextElementDOM(el) {
    const dom = document.getElementById('dom_' + el.id);
    if (!dom) return;

    const inner = dom.querySelector('.pdf-element-text');
    if (inner) {
      inner.innerText = el.text;
      inner.style.fontFamily = getFontFamilyStyle(el.font);
      inner.style.fontSize = el.size + 'px';
      inner.style.color = el.color;
      inner.style.textAlign = el.align;
      
      inner.style.fontWeight = el.font.includes('Bold') ? 'bold' : 'normal';
      inner.style.fontStyle = (el.font.includes('Oblique') || el.font.includes('Italic')) ? 'italic' : 'normal';
    }
  }

  function updateShapeElementDOM(el) {
    const dom = document.getElementById('dom_' + el.id);
    if (!dom) return;

    const svg = dom.querySelector('.pdf-element-shape');
    if (svg) {
      if (el.type === 'rect') {
        const rect = svg.querySelector('rect');
        if (rect) {
          rect.setAttribute('fill', el.fillTransparent ? 'transparent' : el.fill);
          rect.setAttribute('stroke', el.strokeWidth > 0 ? el.stroke : 'transparent');
          rect.setAttribute('stroke-width', el.strokeWidth);
        }
      } else if (el.type === 'circle') {
        const ellipse = svg.querySelector('ellipse');
        if (ellipse) {
          ellipse.setAttribute('fill', el.fillTransparent ? 'transparent' : el.fill);
          ellipse.setAttribute('stroke', el.strokeWidth > 0 ? el.stroke : 'transparent');
          ellipse.setAttribute('stroke-width', el.strokeWidth);
          ellipse.setAttribute('rx', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
          ellipse.setAttribute('ry', 'calc(50% - ' + (el.strokeWidth/2) + 'px)');
        }
      }
    }
  }

  // --- ELEMENT ACTIONS (CRUD) ---
  function createElementOnActivePage(type) {
    if (!state.selectedPageId) {
      alert("Please select or add a page first.");
      return;
    }

    const page = state.pages.find(p => p.id === state.selectedPageId);
    if (!page) return;

    const id = 'el_' + Date.now();
    let newEl = {
      id: id,
      type: type,
      x: 100,
      y: 100,
      w: 120,
      h: 50,
      zIndex: page.elements.length + 5
    };

    if (type === 'text') {
      newEl.text = 'New Text Block';
      newEl.font = 'Helvetica';
      newEl.size = 12;
      newEl.color = '#000000';
      newEl.align = 'left';
      newEl.h = 24;
      newEl.w = 150;
    } else if (type === 'rect' || type === 'circle') {
      newEl.fill = '#e2e8f0';
      newEl.stroke = '#6366f1';
      newEl.strokeWidth = 2;
      newEl.fillTransparent = false;
      newEl.w = 100;
      newEl.h = 100;
    } else if (type === 'image') {
      newEl.src = PLACEHOLDER_PNG;
      newEl.opacity = 100;
      newEl.w = 120;
      newEl.h = 120;
    }

    page.elements.push(newEl);
    
    renderWorkspace();
    selectElement(id);
    saveToLocalStorage();
    triggerCompile();
  }

  function deleteElement(id) {
    const page = state.pages.find(p => p.id === state.selectedPageId);
    if (!page) return;

    page.elements = page.elements.filter(el => el.id !== id);
    selectElement(null);
    renderWorkspace();
    saveToLocalStorage();
    triggerCompile();
  }

  function deletePage(pageId) {
    if (state.pages.length <= 1) {
      alert("Documents must contain at least 1 page.");
      return;
    }

    if (confirm("Are you sure you want to delete this page? All elements inside it will be lost.")) {
      const delIndex = state.pages.findIndex(p => p.id === pageId);
      state.pages = state.pages.filter(p => p.id !== pageId);
      
      // Select appropriate page
      if (state.selectedPageId === pageId) {
        const newSelIndex = Math.max(0, delIndex - 1);
        state.selectedPageId = state.pages[newSelIndex].id;
      }
      
      selectElement(null);
      renderWorkspace();
      saveToLocalStorage();
      triggerCompile();
    }
  }

  // --- ZOOM HANDLING ---
  function applyZoom() {
    elZoomLevel.innerText = Math.round(state.zoom * 100) + '%';
    elCanvasContainer.style.transform = `scale(${state.zoom})`;
  }

  // --- SIGNATURE PAD CANVAS DRAWINGS ---
  function openSignatureModal() {
    modalSignature.classList.remove('hidden');
    clearSignatureCanvas();
  }

  function closeSignatureModal() {
    modalSignature.classList.add('hidden');
  }

  function clearSignatureCanvas() {
    sigCtx.fillStyle = '#ffffff';
    sigCtx.fillRect(0, 0, canvasSig.width, canvasSig.height);
  }

  function startDrawingSignature(e) {
    const rect = canvasSig.getBoundingClientRect();
    sigCtx.beginPath();
    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    isDrawingSig = true;
  }

  function drawSignature(e) {
    if (!isDrawingSig) return;
    const rect = canvasSig.getBoundingClientRect();
    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    sigCtx.strokeStyle = activeSigColor;
    sigCtx.lineWidth = 3;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.stroke();
  }

  function stopDrawingSignature() {
    isDrawingSig = false;
  }

  function saveSignatureToCanvas() {
    // Generate cropped canvas to avoid wide margins
    const imgDataUrl = getCroppedSignatureURL();
    
    const page = state.pages.find(p => p.id === state.selectedPageId);
    if (!page) {
      alert("Choose a page first.");
      closeSignatureModal();
      return;
    }

    const id = 'el_sig_' + Date.now();
    const newEl = {
      id: id,
      type: 'signature',
      x: 150,
      y: 400,
      w: 120,
      h: 60,
      src: imgDataUrl,
      opacity: 100,
      zIndex: page.elements.length + 5
    };

    page.elements.push(newEl);
    closeSignatureModal();
    renderWorkspace();
    selectElement(id);
    saveToLocalStorage();
    triggerCompile();
  }

  // Crops bounding box of signature drawing for tight layout margins
  function getCroppedSignatureURL() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    const w = canvasSig.width;
    const h = canvasSig.height;
    const imgData = sigCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let found = false;

    // Detect pixel bounds (checking for non-white pixels)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        const a = data[idx+3];
        
        // If not white pixel (and has some opacity)
        if (r < 250 || g < 250 || b < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) {
      return canvasSig.toDataURL(); // Return empty if blank
    }

    // Add small padding to bounds
    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    
    // Copy cropped area from original drawing
    tempCtx.drawImage(canvasSig, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    // Make signature drawing background transparent instead of solid white
    const finalImgData = tempCtx.getImageData(0, 0, cropW, cropH);
    const finalData = finalImgData.data;
    for (let i = 0; i < finalData.length; i += 4) {
      // Convert white pixels to transparent
      if (finalData[i] > 240 && finalData[i+1] > 240 && finalData[i+2] > 240) {
        finalData[i+3] = 0;
      }
    }
    tempCtx.putImageData(finalImgData, 0, 0);

    return tempCanvas.toDataURL('image/png');
  }

  // --- LIVE DEBOUNCED COMPILER ---
  let compileTimeout;
  function triggerCompile() {
    if (!state.isSplitPreview) return;
    
    setStatus('Drafting...', 'yellow');
    clearTimeout(compileTimeout);
    compileTimeout = setTimeout(() => {
      compilePDF(false);
    }, 600);
  }

  function setStatus(text, dotColor) {
    elStatusText.innerText = text;
    elStatusDot.className = 'status-dot ' + dotColor;
  }

  // --- PDF-LIB COMPILATION ENGINE ---
  async function compilePDF(download = false) {
    if (!download && !state.isSplitPreview) return;
    
    if (!download) elPdfLoading.classList.add('active');
    setStatus('Compiling PDF...', 'yellow');

    try {
      const pdfDoc = await PDFDocument.create();

      // Helper to convert hex to RGB object for pdf-lib
      const hexToRgb = (hexStr) => {
        const clean = hexStr.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16) / 255;
        const g = parseInt(clean.substring(2, 4), 16) / 255;
        const b = parseInt(clean.substring(4, 6), 16) / 255;
        return rgb(r, g, b);
      };

      // Helper to decode Base64 dataURL to Uint8Array
      const decodeBase64ToUint8Array = (dataurl) => {
        const parts = dataurl.split(',');
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        return array;
      };

      for (const pageState of state.pages) {
        // Create matching A4 Page size
        const pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        // Process and draw elements on this page
        for (const el of pageState.elements) {
          
          // PDF Coordinate Space Conversion: 
          // HTML Y (from top) -> PDF Y (from bottom)
          const pdfY = PAGE_HEIGHT - el.y - el.h;
          
          if (el.type === 'text') {
            const fontRef = await pdfDoc.embedFont(el.font || StandardFonts.Helvetica);
            const fontColor = hexToRgb(el.color || '#000000');
            
            // Standardize line wrapping and positioning
            pdfPage.drawText(el.text, {
              x: el.x + 4, // Padding offset
              y: pdfY + 4 + (el.h - el.size)/2, // Centering text vertically
              size: el.size,
              font: fontRef,
              color: fontColor,
              maxWidth: el.w - 8,
              lineHeight: el.size * 1.2
            });
          } else if (el.type === 'rect') {
            pdfPage.drawRectangle({
              x: el.x,
              y: pdfY,
              width: el.w,
              height: el.h,
              fillColor: el.fillTransparent ? undefined : hexToRgb(el.fill),
              borderColor: el.strokeWidth > 0 ? hexToRgb(el.stroke) : undefined,
              borderWidth: el.strokeWidth || 0
            });
          } else if (el.type === 'circle') {
            // Draw circle using ellipse drawing
            pdfPage.drawEllipse({
              x: el.x + el.w/2,
              y: pdfY + el.h/2,
              xRadius: el.w/2,
              yRadius: el.h/2,
              fillColor: el.fillTransparent ? undefined : hexToRgb(el.fill),
              borderColor: el.strokeWidth > 0 ? hexToRgb(el.stroke) : undefined,
              borderWidth: el.strokeWidth || 0
            });
          } else if (el.type === 'image' || el.type === 'signature') {
            if (el.src && el.src !== PLACEHOLDER_PNG) {
              const imageBytes = decodeBase64ToUint8Array(el.src);
              let embeddedImage;
              
              // Detect mime type
              if (el.src.includes('image/png')) {
                embeddedImage = await pdfDoc.embedPng(imageBytes);
              } else {
                embeddedImage = await pdfDoc.embedJpg(imageBytes);
              }

              pdfPage.drawImage(embeddedImage, {
                x: el.x,
                y: pdfY,
                width: el.w,
                height: el.h,
                opacity: (el.opacity !== undefined ? el.opacity : 100) / 100
              });
            }
          }
        }
      }

      // Generate binary and link
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'korlyn_document_' + Date.now() + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus('PDF Exported', 'green');
      } else {
        // Load into preview frame
        elPdfPreviewFrame.src = url;
        elPdfPreviewFrame.onload = () => {
          elPdfLoading.classList.remove('active');
          setStatus('Live Preview Active', 'green');
        };
      }
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      setStatus('Compilation Error', 'yellow');
      if (!download) elPdfLoading.classList.remove('active');
    }
  }

  // Run on start
  init();
})();
