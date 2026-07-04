const VISIBLE_MIN = 380.0;
const VISIBLE_MAX = 750.0;
const C = 299792458.0;
const H = 6.62607015e-34;
const K = 1.380649e-23;

const lamp_db = {
  "fluorescent": {
    "lines_nm": [404.7, 435.8, 546.1, 577.0, 579.1],
    "intensities": [0.35, 0.85, 1.0, 0.7, 0.6],
    "background_strength": 0.35
  },
  "sodium": {
    "lines_nm": [589.0, 589.6],
    "intensities": [1.0, 0.92],
    "background_strength": 0.05
  },
  "mercury": {
    "lines_nm": [365.0, 404.7, 435.8, 546.1, 577.0, 579.1],
    "intensities": [0.2, 0.55, 0.9, 1.0, 0.75, 0.65],
    "background_strength": 0.12
  },
  "hydrogen": {
    "lines_nm": [410.2, 434.0, 486.1, 656.3],
    "intensities": [0.05, 0.15, 0.4, 1.0],
    "background_strength": 0.0
  },
  "helium": {
    "lines_nm": [388.9, 447.1, 471.3, 492.2, 501.6, 587.6, 667.8, 706.5, 728.1],
    "intensities": [0.1, 0.3, 0.1, 0.1, 0.2, 1.0, 0.5, 0.4, 0.1],
    "background_strength": 0.05
  },
  "neon": {
    "lines_nm": [540.1, 585.2, 588.2, 594.5, 603.0, 607.4, 609.6, 614.3, 626.6, 633.4, 638.3, 640.2, 650.6, 703.2],
    "intensities": [0.1, 0.5, 0.4, 0.5, 0.4, 0.6, 0.7, 0.9, 0.6, 0.7, 0.8, 1.0, 0.7, 0.5],
    "background_strength": 0.05
  }
};

const absorption_db = {
  "sodium": {
    "lines_nm": [589.0, 589.6],
    "depths": [1.0, 0.95],
    "sigma_nm": 0.4,
    "description": "Natrium D-Linien (Atomspektroskopie)"
  },
  "hydrogen": {
    "lines_nm": [410.2, 434.0, 486.1, 656.3],
    "depths": [0.6, 0.75, 0.85, 1.0],
    "sigma_nm": 0.35,
    "description": "Balmer-Absorptionslinien (Sternspektren)"
  },
  "chlorophyll": {
    "bands": [
      {center: 430, width: 45, depth: 0.95},
      {center: 662, width: 35, depth: 0.9}
    ],
    "description": "Chlorophyll-Absorptionsbänder (Pflanzenpigmente)"
  }
};

function linspace(start, end, num) {
  const arr = new Float32Array(num);
  const step = (end - start) / (num - 1);
  for (let i = 0; i < num; i++) {
    arr[i] = start + step * i;
  }
  return arr;
}

function gaussian(x, mu, sigma) {
  const arr = new Float32Array(x.length);
  const factor = -0.5 / (sigma * sigma);
  for (let i = 0; i < x.length; i++) {
    const diff = x[i] - mu;
    arr[i] = Math.exp(diff * diff * factor);
  }
  return arr;
}

function normalize(arr) {
  let maxv = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > maxv) maxv = arr[i];
  }
  if (maxv > 0) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] /= maxv;
    }
  }
  return arr;
}

function add_arrays(arr1, arr2, factor=1.0) {
  const res = new Float32Array(arr1.length);
  for (let i = 0; i < arr1.length; i++) {
    res[i] = arr1[i] + factor * arr2[i];
  }
  return res;
}

function planck_spectrum(wavelengths, temperature) {
  const intensity = new Float32Array(wavelengths.length);
  let maxv = 0;
  const a = 2.0 * H * C * C;
  for (let i = 0; i < wavelengths.length; i++) {
    const wl_m = wavelengths[i] * 1e-9;
    let b = (H * C) / (wl_m * K * temperature);
    b = Math.max(1e-9, Math.min(b, 700));
    const val = a / (Math.pow(wl_m, 5) * (Math.exp(b) - 1.0));
    intensity[i] = val;
    if (val > maxv) maxv = val;
  }
  if (maxv > 0) {
    for (let i = 0; i < wavelengths.length; i++) intensity[i] /= maxv;
  }
  return intensity;
}

function source_spectrum(source, wavelengths, params) {
  let spec = new Float32Array(wavelengths.length);
  
  if (source === "white") {
    const temp = params.temperature || 6500;
    const base = planck_spectrum(wavelengths, temp);
    const blue_boost = gaussian(wavelengths, 460, 55);
    spec = add_arrays(base, blue_boost, 0.15);
    return normalize(spec);
  }

  if (["fluorescent", "sodium", "mercury", "hydrogen", "helium", "neon"].includes(source)) {
    const lamp = lamp_db[source];
    const bg_strength = lamp.background_strength || 0;
    
    if (source === "fluorescent") {
      const bg = gaussian(wavelengths, 550, 110);
      for(let i=0; i<spec.length; i++) spec[i] = bg_strength * (0.25 + 0.75 * bg[i]);
      for (let j = 0; j < lamp.lines_nm.length; j++) {
        const g = gaussian(wavelengths, lamp.lines_nm[j], 0.7);
        for(let i=0; i<spec.length; i++) spec[i] += lamp.intensities[j] * g[i];
      }
      const red_boost = gaussian(wavelengths, 610, 35);
      for(let i=0; i<spec.length; i++) spec[i] += 0.12 * red_boost[i];
    } else if (source === "sodium") {
      for (let j = 0; j < lamp.lines_nm.length; j++) {
        const g = gaussian(wavelengths, lamp.lines_nm[j], 0.55);
        for(let i=0; i<spec.length; i++) spec[i] += lamp.intensities[j] * g[i];
      }
      const orange_boost = gaussian(wavelengths, 610, 25);
      for(let i=0; i<spec.length; i++) spec[i] += 0.03 * orange_boost[i];
    } else {
      let bg_center = 500;
      let bg_width = 200;
      if(source === "mercury") { bg_center = 540; bg_width = 140; }
      
      const bg = gaussian(wavelengths, bg_center, bg_width);
      for(let i=0; i<spec.length; i++) spec[i] = bg_strength * bg[i];
      for (let j = 0; j < lamp.lines_nm.length; j++) {
        const g = gaussian(wavelengths, lamp.lines_nm[j], 0.6);
        for(let i=0; i<spec.length; i++) spec[i] += lamp.intensities[j] * g[i];
      }
    }
    return normalize(spec);
  }

  for(let i=0; i<spec.length; i++) spec[i] = 1.0;
  return normalize(spec);
}

function absorption_profile(wavelengths, abs_type) {
  const abs = absorption_db[abs_type];
  let transmission = new Float32Array(wavelengths.length);
  for(let i = 0; i < wavelengths.length; i++) transmission[i] = 1.0;

  if (abs.lines_nm) {
    for (let j = 0; j < abs.lines_nm.length; j++) {
      const g = gaussian(wavelengths, abs.lines_nm[j], abs.sigma_nm || 0.5);
      const depth = abs.depths[j] || 0.9;
      for(let i = 0; i < wavelengths.length; i++) {
        transmission[i] *= (1.0 - depth * g[i]);
      }
    }
  } else if (abs.bands) {
    for (let band of abs.bands) {
      const g = gaussian(wavelengths, band.center, band.width / 2.355);
      const depth = band.depth || 0.9;
      for(let i = 0; i < wavelengths.length; i++) {
        transmission[i] *= (1.0 - depth * g[i]);
      }
    }
  }
  return transmission;
}

function apply_absorption(base_spec, transmission) {
  const result = new Float32Array(base_spec.length);
  for(let i = 0; i < base_spec.length; i++) {
    result[i] = base_spec[i] * transmission[i];
  }
  return result;
}

function wavelength_to_rgb(wl) {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440) { r = -(wl - 440)/(440 - 380); b = 1.0; }
  else if (wl >= 440 && wl < 490) { g = (wl - 440)/(490 - 440); b = 1.0; }
  else if (wl >= 490 && wl < 510) { g = 1.0; b = -(wl - 510)/(510 - 490); }
  else if (wl >= 510 && wl < 580) { r = (wl - 510)/(580 - 510); g = 1.0; }
  else if (wl >= 580 && wl < 645) { r = 1.0; g = -(wl - 645)/(645 - 580); }
  else if (wl >= 645 && wl <= 750) { r = 1.0; }

  let factor = 0;
  if (wl >= 380 && wl < 420) factor = 0.3 + 0.7*(wl - 380)/(420 - 380);
  else if (wl >= 420 && wl <= 700) factor = 1.0;
  else if (wl > 700 && wl <= 750) factor = 0.3 + 0.7*(750 - wl)/(750 - 700);

  const gamma = 0.8;
  const adj = (c) => c <= 0 ? 0 : Math.round(Math.pow(c * factor, gamma) * 255);
  return [adj(r), adj(g), adj(b)];
}

function getParams() {
  return {
    mode: document.getElementById('mode').value,
    source: document.getElementById('source').value,
    absorption_type: document.getElementById('absorption_type') ? document.getElementById('absorption_type').value : 'sodium',
    params: {
      lines_per_mm: parseFloat(document.getElementById('lines_per_mm').value),
      order: parseInt(document.getElementById('order').value),
      slit_width: parseFloat(document.getElementById('slit_width').value),
      temperature: parseFloat(document.getElementById('temperature').value),
      width: imageCanvas.width,
      height: imageCanvas.height
    }
  };
}

const ctx = document.getElementById('spectrumChart').getContext('2d');
const peaksEl = document.getElementById('peaks');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d');

let chart = new Chart(ctx, {
  type: 'scatter',
  data: {
    datasets: [{
      label: 'Intensität',
      data: [],
      borderColor: '#7dd3fc',
      backgroundColor: 'rgba(125,211,252,0.12)',
      pointRadius: 0,
      tension: 0.15,
      fill: true,
      showLine: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#e8eaf6' } }, tooltip: { enabled: false } },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 900,
        ticks: { 
          color: '#aab0d6',
          callback: function(value) {
            const w = imageCanvas.width;
            const order = parseInt(document.getElementById('order').value) || 1;
            const lpmm = parseFloat(document.getElementById('lines_per_mm').value) || 600;
            const d = 1e6 / lpmm;
            const rMin = Math.max(-1, Math.min(1, order * 380 / d));
            const rMax = Math.max(-1, Math.min(1, order * 750 / d));
            const tMin = Math.asin(rMin);
            const tMax = Math.asin(rMax);
            let p = (tMax - tMin) * 0.05;
            if(p === 0) p = 0.05;
            const vMin = tMin - p;
            const vMax = tMax + p;
            const theta = vMin + (value / w) * (vMax - vMin);
            const wl = Math.sin(theta) * d / order;
            return Math.round(wl);
          }
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: 'Wellenlänge (nm)', color: '#e8eaf6' }
      },
      y: {
        ticks: { color: '#aab0d6' },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: 'Normierte Intensität', color: '#e8eaf6' },
        min: 0,
        max: 1.05
      }
    }
  }
});

function drawImage(imgDataArray, width, height) {
  const img = imageCtx.createImageData(width, height);
  img.data.set(imgDataArray);
  imageCtx.putImageData(img, 0, 0);
}

function renderPeaks(peaks, label = "Linie") {
  if (!peaks.length) {
    peaksEl.innerHTML = `<div class="peak">Keine sichtbaren ${label.toLowerCase()}n im gewählten Bereich.</div>`;
    return;
  }
  peaksEl.innerHTML = peaks.map(p =>
    `<div class="peak">${p.wavelength_nm.toFixed(1)} nm · ${label} · Ordnung ${p.order} · Winkel ${p.angle_deg.toFixed(2)}°</div>`
  ).join('');
}

function update() {
  const payload = getParams();
  const width = payload.params.width;
  const height = payload.params.height;
  chart.options.scales.x.max = width;

  const order = payload.params.order;
  const d_nm = 1e6 / payload.params.lines_per_mm;
  
  const chartWavelengths = linspace(VISIBLE_MIN, VISIBLE_MAX, 1200);
  let baseSpec = source_spectrum(payload.source, chartWavelengths, payload.params);
  let spec1D = baseSpec;

  if (payload.mode === "absorption") {
    const trans = absorption_profile(chartWavelengths, payload.absorption_type);
    spec1D = apply_absorption(baseSpec, trans);
  }
  
  const rMin = Math.max(-1, Math.min(1, order * 380 / d_nm));
  const rMax = Math.max(-1, Math.min(1, order * 750 / d_nm));
  const tMin = Math.asin(rMin);
  const tMax = Math.asin(rMax);
  let pad = (tMax - tMin) * 0.05;
  if(pad === 0) pad = 0.05;
  const vMin = tMin - pad;
  const vMax = tMax + pad;

  const dataPoints = [];
  for (let i = 0; i < chartWavelengths.length; i++) {
    const wl = chartWavelengths[i];
    const intensity = spec1D[i];
    const ratio = order * wl / d_nm;
    if (Math.abs(ratio) <= 1) {
      const theta = Math.asin(ratio);
      const x = (theta - vMin) / (vMax - vMin) * width;
      dataPoints.push({ x: x, y: intensity });
    }
  }

  chart.data.datasets[0].data = dataPoints;
  chart.options.animation = false;
  chart.update();
  
  const chartArea = chart.chartArea;
  if (chartArea) {
    imageCanvas.style.marginLeft = chartArea.left + 'px';
    imageCanvas.style.width = chartArea.width + 'px';
  }

  let lines = [];
  let peakLabel = "Linie";
  if (payload.mode === "absorption") {
    const abs = absorption_db[payload.absorption_type];
    if (abs.lines_nm) lines = abs.lines_nm;
    else if (abs.bands) lines = abs.bands.map(b => b.center);
    peakLabel = "Absorptionslinie";
  } else if (lamp_db[payload.source]) {
    lines = lamp_db[payload.source].lines_nm || [];
  }
  
  const validPeaks = [];
  for (const wl of lines) {
    const ratio = order * wl / d_nm;
    if (Math.abs(ratio) <= 1) {
      const theta = Math.asin(ratio) * (180 / Math.PI);
      validPeaks.push({"wavelength_nm": wl, "angle_deg": theta, "order": order});
    }
  }
  renderPeaks(validPeaks, peakLabel);

  const imgWavelengths = linspace(VISIBLE_MIN, VISIBLE_MAX, width);
  let specImg = source_spectrum(payload.source, imgWavelengths, payload.params);
  
  if (payload.mode === "absorption") {
    const transImg = absorption_profile(imgWavelengths, payload.absorption_type);
    specImg = apply_absorption(specImg, transImg);
  }
  
  const lineRgb = new Float32Array(width * 3);
  const sigma_px = Math.max(1.2, 1.2 + payload.params.slit_width * 2.0);
  const intensity_scale = 1.0 / (sigma_px * 0.8);

  for (let i = 0; i < imgWavelengths.length; i++) {
    const wl = imgWavelengths[i];
    const ratio = order * wl / d_nm;
    if (Math.abs(ratio) <= 1) {
      const theta = Math.asin(ratio);
      const pos = (theta - vMin) / (vMax - vMin) * width;
      
      const rgb = wavelength_to_rgb(wl);
      const amp = specImg[i] * intensity_scale;
      
      const min_x = Math.max(0, Math.floor(pos - 4 * sigma_px));
      const max_x = Math.min(width - 1, Math.ceil(pos + 4 * sigma_px));
      
      const factor = -0.5 / (sigma_px * sigma_px);
      for (let x = min_x; x <= max_x; x++) {
        const diff = x - pos;
        const profile = Math.exp(diff * diff * factor);
        const w = profile * amp;
        const idx = x * 3;
        lineRgb[idx] += w * rgb[0];
        lineRgb[idx+1] += w * rgb[1];
        lineRgb[idx+2] += w * rgb[2];
      }
    }
  }

  const imgData = new Uint8ClampedArray(width * height * 4);
  const bg_vals = new Float32Array(height);
  for(let y=0; y<height; y++) bg_vals[y] = 18 - (10 * y / height);

  for (let y = 0; y < height; y++) {
    const bg = bg_vals[y];
    for (let x = 0; x < width; x++) {
      const px_idx = (y * width + x) * 4;
      const lx_idx = x * 3;
      imgData[px_idx] = Math.max(bg, Math.min(255, lineRgb[lx_idx]));
      imgData[px_idx+1] = Math.max(bg, Math.min(255, lineRgb[lx_idx+1]));
      imgData[px_idx+2] = Math.max(bg, Math.min(255, lineRgb[lx_idx+2]));
      imgData[px_idx+3] = 255;
    }
  }

  drawImage(imgData, width, height);
}
// === DOM READY ===
document.addEventListener('DOMContentLoaded', function() {

  document.querySelectorAll('input').forEach(el => el.addEventListener('input', update));
  document.querySelectorAll('select').forEach(el => el.addEventListener('change', update));

  // Mode switching
  const modeSelect = document.getElementById('mode');
  const absLabel = document.getElementById('absorption-label');
  if (modeSelect && absLabel) {
    modeSelect.addEventListener('change', () => {
      absLabel.style.display = modeSelect.value === 'absorption' ? 'flex' : 'none';
      if (modeSelect.value === 'absorption') {
        const sourceSelect = document.getElementById('source');
        if (sourceSelect && sourceSelect.value !== 'white') {
          sourceSelect.value = 'white';
        }
      }
      update();
    });
  }

  // Modal-Logik
  const helpModal = document.getElementById('helpModal');
  const helpBtn = document.getElementById('helpBtn');
  const closeBtn = document.querySelector('#helpModal .close-btn');
  const helpText = document.getElementById('helpText');

  const impressumLink = document.getElementById('impressumLink');
  const impressumModal = document.getElementById('impressumModal');
  const closeImpressum = document.getElementById('closeImpressum');

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      helpModal.style.display = "block";
      
      if (!helpText.innerHTML.trim()) {
        const text = document.getElementById('readmeContent').textContent;
        helpText.innerHTML = marked.parse(text);
        
        if (window.renderMathInElement) {
          renderMathInElement(helpText, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ]
          });
        }

        const img = document.createElement('img');
        img.src = 'favicon.png';
        img.alt = 'Spektrometer-Simulation Logo';
        img.style.maxWidth = '50%';
        img.style.marginTop = '25px';
        img.style.borderRadius = '8px';
        img.style.display = 'block';
        helpText.appendChild(img);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      helpModal.style.display = "none";
    });
  }

  if (impressumLink && impressumModal && closeImpressum) {
    impressumLink.addEventListener('click', (e) => {
      e.preventDefault();
      impressumModal.style.display = 'block';
    });

    closeImpressum.addEventListener('click', () => {
      impressumModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
      if (e.target === impressumModal) impressumModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (event) => {
    if (event.target === helpModal) {
      helpModal.style.display = "none";
    }
  });

  setTimeout(update, 100);
});
