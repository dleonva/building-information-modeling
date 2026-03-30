/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react'; // Importamos hooks básicos de React para manejar el ciclo de vida y el estado.
import * as THREE from 'three'; // Importamos la biblioteca Three.js para renderizado de gráficos 3D.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Importamos controles para que el usuario pueda rotar la cámara.
import { jsPDF } from 'jspdf'; // Importamos jsPDF para generar archivos PDF con los planos.
import { Box, Download, Layers, Maximize2, Menu, Settings, Info, FileText, Image as ImageIcon } from 'lucide-react'; // Importamos iconos para la interfaz de usuario.

export default function App() {
  // Definimos estados para las dimensiones paramétricas de la pieza.
  const [width, setWidth] = useState(56); // Ancho inicial de 56 mm.
  const [height, setHeight] = useState(28); // Alto inicial de 28 mm.
  const [depth, setDepth] = useState(2); // Profundidad inicial de 2 mm.
  const [materialType, setMaterialType] = useState('wood'); // Estado para el tipo de material.
  const [projectName, setProjectName] = useState('PROYECTO-BIM-001'); // Nombre del proyecto.
  const [projectDesc, setProjectDesc] = useState('DISEÑO DE PIEZA ESTRUCTURAL'); // Descripción del proyecto.
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Estado para el menú lateral.
  const [showWireframe, setShowWireframe] = useState(false); // Estado para mostrar estructura de alambre.
  const [showGrid, setShowGrid] = useState(true); // Estado para mostrar la cuadrícula.

  // Referencias para Three.js.
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Definición de materiales disponibles.
  const materials = {
    wood: { color: 0x8b4513, name: 'Madera Pino', density: 500 },
    steel: { color: 0x444444, name: 'Acero Estructural', density: 7850 },
    concrete: { color: 0x999999, name: 'Hormigón Armado', density: 2400 },
    aluminum: { color: 0xd1d1d1, name: 'Aluminio', density: 2700 },
    glass: { color: 0xaaddff, name: 'Vidrio Templado', density: 2500 },
    plastic: { color: 0x333333, name: 'Polímero ABS', density: 1040 }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Limpieza preventiva del contenedor para evitar duplicados en StrictMode
    const container = mountRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // --- CONFIGURACIÓN DE LA ESCENA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xedeff2); // Fondo gris muy claro para contraste
    sceneRef.current = scene;

    // --- CONFIGURACIÓN DE LA CÁMARA ---
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.set(250, 250, 250);
    cameraRef.current = camera;

    // --- CONFIGURACIÓN DEL RENDERIZADOR ---
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true,
      alpha: true,
      logarithmicDepthBuffer: true // Mejora la precisión de profundidad
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Mejor fidelidad de color
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- ILUMINACIÓN ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(200, 400, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-200, 200, -200);
    scene.add(pointLight);

    // --- AYUDANTES VISUALES ---
    const gridHelper = new THREE.GridHelper(1000, 40, 0xcccccc, 0xdddddd);
    gridHelper.position.y = 0.05;
    gridHelper.visible = showGrid;
    scene.add(gridHelper);
    const gridRef = { current: gridHelper };

    // --- PLANO DE SUELO ---
    const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xd1d5db, // Slate-300 para contraste con el fondo
      roughness: 0.8,
      metalness: 0.1
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // --- GEOMETRÍA PARAMÉTRICA ---
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: materials[materialType as keyof typeof materials].color,
      roughness: 0.5,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(width, height, depth);
    mesh.position.y = height / 2;
    scene.add(mesh);
    meshRef.current = mesh;

    // --- CONTROLES ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // --- BUCLE DE ANIMACIÓN ---
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- MANEJO DE RESIZE ---
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- LIMPIEZA ---
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      planeGeometry.dispose();
      planeMaterial.dispose();
    };
  }, []);

  // Efecto para actualizar las dimensiones y material del objeto 3D.
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.scale.set(width, height, depth);
      meshRef.current.position.y = height / 2;
      
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.color.setHex(materials[materialType as keyof typeof materials].color);
      mat.wireframe = showWireframe;
    }
    // Actualizar visibilidad de la cuadrícula
    if (sceneRef.current) {
      sceneRef.current.children.forEach(child => {
        if (child instanceof THREE.GridHelper) {
          child.visible = showGrid;
        }
      });
    }
  }, [width, height, depth, materialType, showWireframe, showGrid]);

  // Función para centrar la cámara en el objeto.
  const centerCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dist = Math.max(width, height, depth) * 3;
    cameraRef.current.position.set(dist, dist, dist);
    cameraRef.current.lookAt(0, height / 2, 0);
    controlsRef.current.target.set(0, height / 2, 0);
    controlsRef.current.update();
  };

  // Función para exportar la vista actual como una imagen PNG.
  const exportImage = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return; // Verificamos que los objetos necesarios existan.
    rendererRef.current.render(sceneRef.current, cameraRef.current); // Forzamos un renderizado para asegurar que el buffer esté actualizado.
    const dataURL = rendererRef.current.domElement.toDataURL('image/png'); // Obtenemos los datos de la imagen en formato base64.
    const link = document.createElement('a'); // Creamos un elemento de enlace temporal.
    link.download = 'plano-madera.png'; // Definimos el nombre del archivo de descarga.
    link.href = dataURL; // Asignamos la URL de la imagen al enlace.
    link.click(); // Simulamos un clic para iniciar la descarga.
  };

  // Función para exportar un PDF con las vistas principales y acotado técnico en SI.
  const exportPDF = async () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const currentMat = materials[materialType as keyof typeof materials];
    
    // Configuración de página y márgenes
    const margin = 10;
    const pageWidth = 210;
    const pageHeight = 297;
    
    // Marco exterior
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Rótulo (Stamp) Profesional en la parte inferior
    const stampHeight = 35;
    const stampY = pageHeight - margin - stampHeight;
    pdf.rect(margin, stampY, pageWidth - 2 * margin, stampHeight);
    
    // Divisiones del rótulo
    pdf.line(margin + 100, stampY, margin + 100, pageHeight - margin);
    pdf.line(margin + 150, stampY, margin + 150, pageHeight - margin);
    pdf.line(margin + 150, stampY + 17, pageWidth - margin, stampY + 17);

    // Contenido del rótulo
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('BIM DESIGNER REPORT', margin + 5, stampY + 10);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`PROYECTO: ${projectName}`, margin + 5, stampY + 18);
    pdf.text(`DESCRIPCIÓN: ${projectDesc}`, margin + 5, stampY + 24);
    pdf.text(`UBICACIÓN: SISTEMA INTERNACIONAL [SI]`, margin + 5, stampY + 30);

    pdf.text('INGENIERO RESPONSABLE:', margin + 105, stampY + 10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(process.env.USER_EMAIL || 'correodavidlv@gmail.com', margin + 105, stampY + 18);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text('FECHA:', margin + 155, stampY + 8);
    pdf.text(new Date().toLocaleDateString(), margin + 155, stampY + 13);
    pdf.text('ESCALA:', margin + 155, stampY + 25);
    pdf.text('S/E', margin + 155, stampY + 30);

    // Encabezado de página
    pdf.setFillColor(30, 41, 59);
    pdf.rect(margin, margin, pageWidth - 2 * margin, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text('PLANO TÉCNICO DE ELEMENTO ESTRUCTURAL', pageWidth / 2, margin + 13, { align: 'center' });

    // Especificaciones Técnicas
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ESPECIFICACIONES DEL MATERIAL', margin + 5, 40);
    pdf.line(margin + 5, 42, 80, 42);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Material: ${currentMat.name}`, margin + 5, 48);
    pdf.text(`Densidad: ${currentMat.density} [kg/m³]`, margin + 5, 54);
    pdf.text(`Masa: ${((width * height * depth * currentMat.density) / 1000000000).toFixed(4)} [kg]`, margin + 5, 60);

    // Dimensiones
    pdf.setFont('helvetica', 'bold');
    pdf.text('DIMENSIONES NOMINALES', 110, 40);
    pdf.line(110, 42, 185, 42);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Ancho (X): ${width} [mm]`, 110, 48);
    pdf.text(`Alto (Y): ${height} [mm]`, 110, 54);
    pdf.text(`Profundidad (Z): ${depth} [mm]`, 110, 60);

    // Función para dibujar cotas técnicas mejoradas
    const drawTechnicalDim = (x1: number, y1: number, x2: number, y2: number, label: string, isVertical: boolean = false) => {
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.15);
      const offset = 6;
      
      if (isVertical) {
        pdf.line(x1 - offset, y1, x1 - offset, y2); // Línea de cota
        pdf.line(x1 - offset - 2, y1, x1 + 1, y1); // Referencia superior
        pdf.line(x1 - offset - 2, y2, x1 + 1, y2); // Referencia inferior
        
        // Flechas (estilo arquitectónico)
        pdf.line(x1 - offset - 1, y1 + 1, x1 - offset + 1, y1 - 1);
        pdf.line(x1 - offset - 1, y2 + 1, x1 - offset + 1, y2 - 1);
        
        pdf.setFontSize(6);
        pdf.text(`[${label}]`, x1 - offset - 1, (y1 + y2) / 2, { angle: 90, align: 'center' });
      } else {
        pdf.line(x1, y1 + offset, x2, y1 + offset); // Línea de cota
        pdf.line(x1, y1 - 1, x1, y1 + offset + 2); // Referencia izquierda
        pdf.line(x2, y1 - 1, x2, y1 + offset + 2); // Referencia derecha
        
        // Flechas (estilo arquitectónico)
        pdf.line(x1 - 1, y1 + offset + 1, x1 + 1, y1 + offset - 1);
        pdf.line(x2 - 1, y2 + offset + 1, x2 + 1, y2 + offset - 1);
        
        pdf.setFontSize(6);
        pdf.text(`[${label}]`, (x1 + x2) / 2, y1 + offset - 1, { align: 'center' });
      }
    };

    const maxDim = Math.max(width, height, depth);
    const dist = maxDim * 3.0;

    const views = [
      { name: 'Vista Isométrica', pos: [dist, dist, dist], target: [0, height / 2, 0], x: 15, y: 75 },
      { name: 'Vista Superior (Planta)', pos: [0, dist * 2, 0], target: [0, 0, 0], x: 110, y: 75 },
      { name: 'Vista Frontal (Alzado)', pos: [0, height / 2, dist * 2], target: [0, height / 2, 0], x: 15, y: 160 },
      { name: 'Vista Lateral (Perfil)', pos: [dist * 2, height / 2, 0], target: [0, height / 2, 0], x: 110, y: 160 }
    ];

    for (const view of views) {
      cameraRef.current.position.set(view.pos[0], view.pos[1], view.pos[2]);
      cameraRef.current.lookAt(view.target[0], view.target[1], view.target[2]);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const imgData = rendererRef.current.domElement.toDataURL('image/png');
      
      pdf.setDrawColor(230, 230, 230);
      pdf.rect(view.x, view.y, 85, 65);
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(view.name.toUpperCase(), view.x, view.y - 2);
      pdf.addImage(imgData, 'PNG', view.x + 1, view.y + 1, 83, 63);
      
      pdf.setFont('helvetica', 'normal');
      if (view.name.includes('Planta')) {
        drawTechnicalDim(view.x + 5, view.y + 60, view.x + 80, view.y + 60, `${width} mm`);
        drawTechnicalDim(view.x + 5, view.y + 5, view.x + 5, view.y + 60, `${depth} mm`, true);
      }
      if (view.name.includes('Alzado')) {
        drawTechnicalDim(view.x + 5, view.y + 60, view.x + 80, view.y + 60, `${width} mm`);
        drawTechnicalDim(view.x + 5, view.y + 5, view.x + 5, view.y + 60, `${height} mm`, true);
      }
      if (view.name.includes('Perfil')) {
        drawTechnicalDim(view.x + 5, view.y + 60, view.x + 80, view.y + 60, `${depth} mm`);
        drawTechnicalDim(view.x + 5, view.y + 5, view.x + 5, view.y + 60, `${height} mm`, true);
      }
    }

    pdf.save(`${projectName}-BIM-TECHNICAL-DRAWING.pdf`);
    centerCamera();
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 font-sans text-neutral-900"> {/* Contenedor principal con flexbox, altura mínima y estilos de fondo/fuente. */}
      {/* BARRA DE NAVEGACIÓN */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-50"> {/* Barra superior fija con sombra y bordes. */}
        <div className="flex items-center gap-2"> {/* Contenedor para el logo y nombre. */}
          <Box className="text-blue-600 w-6 h-6" /> {/* Icono de caja representando el diseño 3D. */}
          <span className="text-xl font-bold tracking-tight">BIM Designer</span> {/* Nombre de la aplicación. */}
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600"> {/* Enlaces de navegación para escritorio. */}
          <a href="#" className="hover:text-blue-600 transition-colors">Diseño</a> {/* Enlace a inicio. */}
          <a href="#" className="hover:text-blue-600 transition-colors">Materiales</a> {/* Enlace a proyectos. */}
          <a href="#" className="hover:text-blue-600 transition-colors">Documentación</a>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"> {/* Botón para abrir el menú móvil. */}
          <Menu className="w-5 h-5" /> {/* Icono de menú. */}
        </button>
      </nav>

      {/* MENÚ MÓVIL (VISIBLE SI isMenuOpen ES TRUE) */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-neutral-200 p-4 flex flex-col gap-4"> {/* Contenedor del menú móvil. */}
          <a href="#" className="text-sm font-medium py-2 border-b border-neutral-50">Inicio</a> {/* Enlace móvil. */}
          <a href="#" className="text-sm font-medium py-2 border-b border-neutral-50">Proyectos</a> {/* Enlace móvil. */}
          <a href="#" className="text-sm font-medium py-2 border-b border-neutral-50">Documentación</a> {/* Enlace móvil. */}
          <a href="#" className="text-sm font-medium py-2">Soporte</a> {/* Enlace móvil. */}
        </div>
      )}

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden"> {/* Área principal dividida en panel lateral y visor 3D. */}
        {/* PANEL DE CONTROL LATERAL */}
        <aside className="w-full md:w-80 bg-white border-r border-neutral-200 p-6 flex flex-col gap-8 overflow-y-auto"> {/* Panel lateral con controles paramétricos. */}
          <section> {/* Sección de parámetros. */}
            <div className="flex items-center gap-2 mb-4"> {/* Cabecera de la sección. */}
              <Settings className="w-4 h-4 text-neutral-400" /> {/* Icono de ajustes. */}
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Configuración BIM</h2> {/* Título de la sección. */}
            </div>
            
            {/* Nombre del Proyecto */}
            <div className="mb-4 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Nombre del Proyecto</label>
              <input 
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value.toUpperCase())}
                className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="EJ: PROYECTO-001"
              />
            </div>

            {/* Descripción del Proyecto */}
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Descripción</label>
              <input 
                type="text"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value.toUpperCase())}
                className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="EJ: PIEZA ESTRUCTURAL"
              />
            </div>

            {/* Selector de Materiales */}
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Material de la Pieza</label>
              <select 
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="wood">Madera Pino</option>
                <option value="steel">Acero Estructural</option>
                <option value="concrete">Hormigón Armado</option>
                <option value="aluminum">Aluminio</option>
                <option value="glass">Vidrio Templado</option>
                <option value="plastic">Polímero ABS</option>
              </select>
            </div>

            {/* Visualización */}
            <div className="mb-4 flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Estructura (Wireframe)</label>
              <button 
                onClick={() => setShowWireframe(!showWireframe)}
                className={`w-10 h-5 rounded-full transition-all relative ${showWireframe ? 'bg-blue-600' : 'bg-neutral-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showWireframe ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="mb-6 flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Mostrar Cuadrícula</label>
              <button 
                onClick={() => setShowGrid(!showGrid)}
                className={`w-10 h-5 rounded-full transition-all relative ${showGrid ? 'bg-blue-600' : 'bg-neutral-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showGrid ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-6"> {/* Espaciado entre controles. */}
              <div className="space-y-2"> {/* Control para el ancho. */}
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold">Ancho (X) <span className="text-[10px] text-neutral-400 font-normal">mm</span></label>
                  <input 
                    type="number" value={width}
                    min="1"
                    onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
                    className="w-16 p-1 text-right text-sm border border-neutral-200 rounded-md font-mono"
                  />
                </div>
                <input 
                  type="range" min="1" max="400" value={width} // Input de rango para modificar el ancho.
                  onChange={(e) => setWidth(Number(e.target.value))} // Actualiza el estado al mover el slider.
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600" // Estilos del slider.
                />
              </div>
              <div className="space-y-2"> {/* Control para el alto. */}
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold">Alto (Y) <span className="text-[10px] text-neutral-400 font-normal">mm</span></label>
                  <input 
                    type="number" value={height}
                    min="1"
                    onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                    className="w-16 p-1 text-right text-sm border border-neutral-200 rounded-md font-mono"
                  />
                </div>
                <input 
                  type="range" min="1" max="400" value={height} // Input de rango para modificar el alto.
                  onChange={(e) => setHeight(Number(e.target.value))} // Actualiza el estado al mover el slider.
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600" // Estilos del slider.
                />
              </div>
              <div className="space-y-2"> {/* Control para la profundidad. */}
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold">Profundidad (Z) <span className="text-[10px] text-neutral-400 font-normal">mm</span></label>
                  <input 
                    type="number" value={depth}
                    min="1"
                    onChange={(e) => setDepth(Math.max(1, Number(e.target.value)))}
                    className="w-16 p-1 text-right text-sm border border-neutral-200 rounded-md font-mono"
                  />
                </div>
                <input 
                  type="range" min="1" max="100" value={depth} // Input de rango para modificar la profundidad.
                  onChange={(e) => setDepth(Number(e.target.value))} // Actualiza el estado al mover el slider.
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600" // Estilos del slider.
                />
              </div>
            </div>
          </section>

          <section className="pt-4">
            <button 
              onClick={centerCamera}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-all text-xs font-bold border border-blue-200"
            >
              <Maximize2 className="w-3 h-3" /> Centrar Cámara
            </button>
          </section>

          <section className="pt-6 border-t border-neutral-100"> {/* Sección de exportación. */}
            <div className="flex items-center gap-2 mb-4"> {/* Cabecera de exportación. */}
              <Download className="w-4 h-4 text-neutral-400" /> {/* Icono de descarga. */}
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Exportación de Planos</h2> {/* Título de exportación. */}
            </div>
            <div className="grid grid-cols-1 gap-3"> {/* Botones de exportación. */}
              <button 
                onClick={exportImage} // Llama a la función para exportar imagen.
                className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all active:scale-95 text-sm font-medium" // Estilos del botón.
              >
                <ImageIcon className="w-4 h-4" /> Exportar Imagen (PNG) {/* Texto e icono del botón. */}
              </button>
              <button 
                onClick={exportPDF} // Llama a la función para exportar PDF.
                className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-200 bg-white text-neutral-900 rounded-xl hover:bg-neutral-50 transition-all active:scale-95 text-sm font-medium" // Estilos del botón.
              >
                <FileText className="w-4 h-4" /> Generar Planos PDF {/* Texto e icono del botón. */}
              </button>
            </div>
          </section>

          <section className="mt-auto pt-6 border-t border-neutral-100"> {/* Sección de concepto BIM. */}
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"> {/* Caja de información. */}
              <div className="flex items-center gap-2 mb-2"> {/* Cabecera de información. */}
                <Info className="w-4 h-4 text-blue-600" /> {/* Icono de información. */}
                <h3 className="text-sm font-bold text-blue-900">Análisis de Masa</h3> {/* Título de información. */}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-blue-800 flex justify-between">
                  Densidad: <span>{materials[materialType as keyof typeof materials].density} kg/m³</span>
                </p>
                <p className="text-[10px] text-blue-800 flex justify-between">
                  Masa Estimada: <span>{((width * height * depth * materials[materialType as keyof typeof materials].density) / 1000000000).toFixed(4)} kg</span>
                </p>
              </div>
            </div>
          </section>
        </aside>


        {/* ÁREA DE VISUALIZACIÓN 3D */}
        <div className="flex-1 flex flex-col relative bg-neutral-100"> {/* Contenedor del visor 3D. */}
          {/* HEADER DE MÓDULO */}
          <header className="bg-white/50 backdrop-blur-sm border-b border-neutral-200 px-6 py-3 flex items-center justify-between z-10"> {/* Cabecera del visor. */}
            <div>
              <h1 className="text-sm font-bold text-neutral-800">Módulo de Diseño Geométrico 3D</h1> {/* Título del módulo. */}
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Iteración 01: Pieza Paramétrica Básica</p> {/* Subtítulo del módulo. */}
            </div>
            <div className="flex gap-2"> {/* Etiquetas de estado. */}
              <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">ESTADO: ACTIVO</div> {/* Etiqueta de estado activo. */}
              <div className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">MODO: PARAMÉTRICO</div> {/* Etiqueta de modo paramétrico. */}
            </div>
          </header>

          <div ref={mountRef} className="flex-1 w-full" /> {/* Elemento donde se renderiza el canvas de Three.js. */}
          
          {/* EXPLICACIÓN DE USO */}
          <div className="absolute bottom-20 left-6 max-w-xs bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/40 shadow-sm pointer-events-none"> {/* Overlay explicativo. */}
            <h4 className="text-xs font-bold mb-1">Análisis Geométrico</h4> {/* Título del análisis. */}
            <p className="text-[10px] text-neutral-600 leading-tight"> {/* Párrafo del análisis. */}
              Este paralelepípedo representa una pieza estructural paramétrica. La lógica BIM permite que las dimensiones se ajusten manteniendo la integridad de los datos técnicos, fundamental en flujos de trabajo de ingeniería moderna.
            </p>
          </div>

          <div className="absolute top-6 right-6 flex flex-col gap-2"> {/* Overlay de datos en tiempo real. */}
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/50 flex items-center gap-4"> {/* Contenedor de datos. */}
              <div className="flex flex-col"> {/* Dato de volumen. */}
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-tighter">Volumen</span> {/* Etiqueta de volumen. */}
                <span className="text-lg font-mono font-bold">{(width * height * depth).toLocaleString()} mm³</span> {/* Valor calculado del volumen. */}
              </div>
              <div className="w-px h-8 bg-neutral-200" /> {/* Divisor visual. */}
              <div className="flex flex-col"> {/* Dato de superficie. */}
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-tighter">Superficie</span> {/* Etiqueta de material. */}
                <span className="text-lg font-mono font-bold">{(2 * (width * height + width * depth + height * depth)).toLocaleString()} mm²</span> {/* Valor del material. */}
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-6"> {/* Indicador de renderizado. */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/10 backdrop-blur-sm rounded-full text-[10px] font-bold text-neutral-600 uppercase tracking-widest"> {/* Estilos del indicador. */}
              <Maximize2 className="w-3 h-3" /> Renderizado en Tiempo Real {/* Icono y texto. */}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-neutral-200 px-6 py-8"> {/* Pie de página. */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12"> {/* Grid para el contenido del footer. */}
          <div className="col-span-1 md:col-span-2"> {/* Columna de marca. */}
            <div className="flex items-center gap-2 mb-4"> {/* Logo en el footer. */}
              <Box className="text-blue-600 w-5 h-5" /> {/* Icono. */}
              <span className="text-lg font-bold">BIM Designer</span> {/* Nombre. */}
            </div>
            <p className="text-sm text-neutral-500 max-w-md leading-relaxed"> {/* Descripción en el footer. */}
              Plataforma avanzada para el diseño paramétrico multi-material. 
              Optimiza tus procesos de ingeniería con exportación de planos técnicos acotados bajo estándares internacionales.
            </p>
          </div>
          <div> {/* Columna de recursos. */}
            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Recursos</h4> {/* Título. */}
            <ul className="text-sm text-neutral-600 space-y-2"> {/* Lista de enlaces. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">Tutoriales BIM</a></li> {/* Enlace. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">API para Desarrolladores</a></li> {/* Enlace. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">Librería de Materiales</a></li> {/* Enlace. */}
            </ul>
          </div>
          <div> {/* Columna legal. */}
            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Legal</h4> {/* Título. */}
            <ul className="text-sm text-neutral-600 space-y-2"> {/* Lista de enlaces. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">Términos de Uso</a></li> {/* Enlace. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">Privacidad</a></li> {/* Enlace. */}
              <li><a href="#" className="hover:text-orange-600 transition-colors">Cookies</a></li> {/* Enlace. */}
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-4"> {/* Barra inferior del footer. */}
          <span className="text-xs text-neutral-400">© 2026 BIM Designer. Todos los derechos reservados.</span> {/* Copyright. */}
          <div className="flex gap-6"> {/* Iconos decorativos. */}
            <Layers className="w-4 h-4 text-neutral-300" /> {/* Icono. */}
            <Box className="w-4 h-4 text-neutral-300" /> {/* Icono. */}
            <Settings className="w-4 h-4 text-neutral-300" /> {/* Icono. */}
          </div>
        </div>
      </footer>
    </div>
  );
}
