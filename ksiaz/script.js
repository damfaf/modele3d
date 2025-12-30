const lamp = document.getElementById("lamp");
const lampText = document.getElementById("lampText");

function setLamp(color, text) {
  lamp.style.background = color;
  lamp.style.boxShadow = `0 0 8px ${color}`;
  lampText.textContent = text;
}


const canvas = document.getElementById("renderCanvas");
  const engine = new BABYLON.Engine(canvas, true);

  // Maksymalna jakość renderowania
  engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
  BABYLON.BaseTexture.UseHighPrecisionFloats = true;

  let camera, ground, dirLight, hemiLight;
  let initialTarget, initialRadius, initialAlpha, initialBeta;
  let envStudio = null, envDay = null, envNight = null, skybox = null;
  let autoRotate = false;
  let userInteracted = false;
  let defaultHemiIntensity = 0.9;
  let defaultDirIntensity = 0.6;

  // --- ANIMACJA KROPEK + PROGRESS ---
  const dotsEl = document.getElementById("dots");
  const loadingEl = document.getElementById("loading");
  const progressBarEl = document.getElementById("progressBar");
  let dotStep = 0;

  const dotInterval = setInterval(() => {
    dotStep = (dotStep + 1) % 4; // 0,1,2,3
    dotsEl.textContent = ". ".repeat(dotStep); // "", ".", ". .", ". . ."
  }, 500);

async function createScene() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.06, 1.0);

    // Maksymalna jakość PBR + HDR
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.2;
    scene.imageProcessingConfiguration.contrast = 1.15;

    // Pełna precyzja shaderów
    scene.getEngine().setTextureFormatToUse(BABYLON.Engine.TEXTUREFORMAT_RGBA);
    // Wymuś wysoką precyzję shaderów
    scene.getEngine()._gl.getExtension("OES_texture_float");
    scene.getEngine()._gl.getExtension("OES_texture_half_float");


    // Kamera
    camera = new BABYLON.ArcRotateCamera(
      "camera",
      2.79, // - Math.PI / 2, //alpha // obrót poziomy
      1.28, //Math.PI / 4, //beta // obrót pionowy
      3, //radius - odleglosc
      new BABYLON.Vector3(0.37735831722667534, 3.1578067912186567, -2.1877524333558873), //target
      scene
    );
    camera.attachControl(canvas, true);

    // 🔥 ZABLOKUJ automatyczne zmiany kamery
    camera.useAutoRotationBehavior = false;
    camera.panningInertia = 0;
    camera.inertia = 0;
    camera.minZ = 0.001;

    camera.wheelDeltaPercentage = 0.02;
    camera.panningSensibility = 500;

    // Światła
    hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);
    hemiLight.intensity = defaultHemiIntensity;

    dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1,-2,-1), scene);
    dirLight.intensity = defaultDirIntensity;

    // HDRI – Studio domyślnie
    envStudio = BABYLON.CubeTexture.CreateFromPrefilteredData(
      "https://playground.babylonjs.com/textures/environment.env",
      scene
    );
    scene.environmentTexture = envStudio;
    scene.environmentIntensity = 1.0;

    skybox = scene.createDefaultSkybox(envStudio, true, 1000, 0.5);


    // Cienie
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, dirLight);
    shadowGenerator.useExponentialShadowMap = true;


    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      "",
      "https://r2-proxy.damian-fafula.workers.dev/", "ksiaz2a.glb",
      scene,
      (event) => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          progressBarEl.style.width = `${Math.min(100, percent)}%`;
        } else {
          // fallback – powoli dochodzi do 90%
          const current = parseFloat(progressBarEl.style.width || "0");
          const next = Math.min(90, current + 1);
          progressBarEl.style.width = `${next}%`;
        }
      }
    );

    // Maksymalna jakość materiałów PBR
    result.meshes.forEach(m => {
        if (m.material && m.material.getClassName() === "PBRMaterial") {
            m.material.forceIrradianceInFragment = true;
            m.material.realTimeFiltering = true;
            m.material.usePhysicalLightFalloff = true;
            m.material.useEnergyConservation = true;
            m.material.maxSimultaneousLights = 8;
        }
    });


    result.meshes.forEach(m => {
        if (m.material) {
            m.material.backFaceCulling = false;
        }
    });


    // // wybieramy pierwszy mesh z załadowanego modelu
    // mesh = result.meshes[0];
    // // obliczamy pivot
    // bbox = mesh.getBoundingInfo().boundingBox;
    // const center = bbox.centerWorld.clone();
    // // ustawiamy pivot
    // mesh.setPivotPoint(center);
    // // wypiekamy transformację
    // mesh.bakeCurrentTransformIntoVertices();
    // mesh.position.set(0, 0, 0);


    let root = result.meshes[0]; 
    while (root.parent) root = root.parent; 

    root.refreshBoundingInfo();
    root.position = BABYLON.Vector3.Zero();
    root.rotation = BABYLON.Vector3.Zero();
    root.scaling = new BABYLON.Vector3(1,1,1);

    // orientacja modelu – przykładowo:
    root.rotation.x = -Math.PI / 2;

    root.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
    root.refreshBoundingInfo();

    const meshes = result.meshes.filter(m => m !== ground && m.name !== "ground");

    // Dodanie do cieni
    meshes.forEach(m => {
      shadowGenerator.addShadowCaster(m);
    });    
    // Maksymalna jakość cieni
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.02;


    // Ustawienie kamery
    //ksiaz
    // W konsoli: camera.alpha, camera.beta, camera.radius, camera.target
    // camera.alpha = 2.79; 
    // camera.beta = 1.28; 
    // camera.radius = 3.23; 
    // camera.setTarget(new BABYLON.Vector3(0.37735831722667534, 3.1578067912186567, -2.1877524333558873));
    // // camera.setTarget(center);
    // camera.radius = radius * 2.5;
    camera.lowerRadiusLimit = camera.radius * 0.0001;
    camera.upperRadiusLimit = camera.radius * 100;

    console.log(
      "START VIEW:",
      "alpha:", camera.alpha,
      "beta:", camera.beta,
      "radius:", camera.radius,
      "target:", camera.target
    );


    // Zapamiętanie pozycji startowej
    initialTarget = new BABYLON.Vector3(0.37735831722667534, 3.1578067912186567, -2.1877524333558873);//center.clone();
    initialRadius = camera.radius;
    initialAlpha = camera.alpha;
    initialBeta = camera.beta;

    // Maksymalna jakość tekstur
    scene.textures.forEach(tex => {
      tex.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      tex.anisotropicFilteringLevel = 16;
      tex.gammaSpace = false;
    });

    // Fade‑in modelu
    meshes.forEach(m => {
      m.visibility = 0;
      BABYLON.Animation.CreateAndStartAnimation(
        "fadeIn",
        m,
        "visibility",
        60,
        60,
        0,
        1,
        0
      );
    });

    // Ukończenie paska postępu
    progressBarEl.style.width = "100%";

    // Fade‑out loadera
    clearInterval(dotInterval);
    loadingEl.style.opacity = "0";
    setTimeout(() => {
      loadingEl.style.display = "none";
    }, 400);


    result.meshes.forEach((m, i) => {
        console.log(
            "Mesh", i,
            "name:", m.name,
            "vertices:", m.getTotalVertices(),
            "isVisible:", m.isVisible,
            "scaling:", m.scaling
        );
    });

    // scene.onBeforeRenderObservable.add(() => { 
    //   console.log( "alpha:", camera.alpha.toFixed(6), 
    //     "beta:", camera.beta.toFixed(6), 
    //     "radius:", camera.radius.toFixed(6), 
    //     "target:", camera.target ); });


    return scene;
  }

  createScene().then(scene => {
    engine.runRenderLoop(() => scene.render());
  });

  window.addEventListener("resize", () => engine.resize());





  // --- Funkcje pomocnicze ---

  function setCameraPreset(alpha, beta, radiusFactor = 1.0) {
    if (!camera || !initialTarget) return;
    camera.setTarget(initialTarget);
    camera.alpha = alpha;
    camera.beta = beta;
    camera.radius = initialRadius * radiusFactor;
  }

  function setAutoRotate(state) {
    autoRotate = state;
    userInteracted = !state; // jeśli włączamy, resetujemy flagę
    document.getElementById("autoRotateBtn").classList.toggle("active", state);
  }

  // --- PRZYCISKI GÓRNE ---

  document.getElementById("resetBtn").onclick = () => {
    if (!camera || !initialTarget) return;
    camera.setTarget(initialTarget);
    camera.radius = initialRadius;
    camera.alpha = initialAlpha;
    camera.beta = initialBeta;
    userInteracted = false;
  };

  document.getElementById("autoRotateBtn").onclick = () => {
    setAutoRotate(!autoRotate);
  };

  document.getElementById("fullscreenBtn").onclick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // --- PRZYCISKI DOLNE (sterowanie kamerą) ---

  document.getElementById("moveLeft").onclick = () => {
    if (!camera) return;
    camera.target.x -= 1;
  };

  document.getElementById("moveRight").onclick = () => {
    if (!camera) return;
    camera.target.x += 1;
  };

  document.getElementById("zoomIn").onclick = () => {
    if (!camera) return;
    camera.radius *= 0.9;
  };

  document.getElementById("zoomOut").onclick = () => {
    if (!camera) return;
    camera.radius *= 1.1;
  };

  document.getElementById("rotateLeft").onclick = () => {
    if (!camera) return;
    camera.alpha -= 0.1;
  };

  document.getElementById("rotateRight").onclick = () => {
    if (!camera) return;
    camera.alpha += 0.1;
  };

  // --- PRESETY WIDOKU ---

  document.getElementById("viewFront").onclick = () => {
    setCameraPreset(0, Math.PI / 2.5, 1.0);
  };
  document.getElementById("viewBack").onclick = () => {
    setCameraPreset(Math.PI, Math.PI / 2.5, 1.0);
  };
  document.getElementById("viewLeft").onclick = () => {
    setCameraPreset(-Math.PI / 2, Math.PI / 2.5, 1.0);
  };
  document.getElementById("viewRight").onclick = () => {
    setCameraPreset(Math.PI / 2, Math.PI / 2.5, 1.0);
  };
  document.getElementById("viewTop").onclick = () => {
    setCameraPreset(0, 0.8, 0.8);
  };

  // --- SKRÓTY KLAWISZOWE ---

  window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    if (key === "r") {
      if (!camera || !initialTarget) return;
      camera.setTarget(initialTarget);
      camera.radius = initialRadius;
      camera.alpha = initialAlpha;
      camera.beta = initialBeta;
      userInteracted = false;
    }

    if (key === " ") {
      e.preventDefault();
      setAutoRotate(!autoRotate);
    }
  });






