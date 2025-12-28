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
  dotStep = (dotStep + 1) % 4;
  dotsEl.textContent = ". ".repeat(dotStep);
}, 500);

async function createScene() {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.06, 1.0);

  // Kamera
  camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 4,
    Math.PI / 3,
    10,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  // 🔥 ZMNIEJSZA SIŁĘ ZOOMU NA TELEFONIE
  camera.pinchPrecision = 200;          // im większe, tym wolniejszy zoom
  camera.pinchDeltaPercentage = 0.002;  // dodatkowa kontrola czułości


  camera.wheelDeltaPercentage = 0.02;
  camera.panningSensibility = 500;

  // Światła
  hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);
  hemiLight.intensity = defaultHemiIntensity;

  dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1,-2,-1), scene);
  dirLight.intensity = defaultDirIntensity;

  // HDRI
  envStudio = BABYLON.CubeTexture.CreateFromPrefilteredData(
    "https://playground.babylonjs.com/textures/environment.env",
    scene
  );
  scene.environmentTexture = envStudio;
  scene.environmentIntensity = 1.0;

  skybox = scene.createDefaultSkybox(envStudio, true, 1000, 0.5);

  // Podłoga
  ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.05, 0.07, 0.11);
  groundMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  groundMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  groundMat.alpha = 0.98;
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.isVisible = false;

  const shadowGenerator = new BABYLON.ShadowGenerator(2048, dirLight);
  shadowGenerator.useExponentialShadowMap = true;

  // Wczytanie modelu
  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    "",
    "https://r2-proxy.damian-fafula.workers.dev/",
    "kosciol3.glb",
    scene,
    (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        progressBarEl.style.width = `${Math.min(100, percent)}%`;
      } else {
        const current = parseFloat(progressBarEl.style.width || "0");
        const next = Math.min(90, current + 1);
        progressBarEl.style.width = `${next}%`;
      }
    }
  );

  const meshes = result.meshes.filter(m => m !== ground && m.name !== "ground");

  meshes.forEach(m => shadowGenerator.addShadowCaster(m));

  // Bounding box
  const min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
  const max = new BABYLON.Vector3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

  meshes.forEach(m => {
    const info = m.getBoundingInfo();
    min.minimizeInPlace(info.boundingBox.minimumWorld);
    max.maximizeInPlace(info.boundingBox.maximumWorld);
  });

  // Podniesienie modelu na podłogę
  const offsetY = -min.y;
  meshes.forEach(m => {
    m.position.y += offsetY;
  });

  // Nowy bbox po podniesieniu
  const newMin = min.add(new BABYLON.Vector3(0, offsetY, 0));
  const newMax = max.add(new BABYLON.Vector3(0, offsetY, 0));

  const center = newMin.add(newMax).scale(0.5);
  const radius = BABYLON.Vector3.Distance(newMin, newMax) * 0.5;



  // Ustawienie kamery na środek modelu
  camera.setTarget(center);

  // Twoje ręczne ustawienia domyślnego widoku
  camera.alpha = 0.252;
  camera.beta = 1.308;
  camera.radius = 19.613;
  camera.lowerRadiusLimit = radius * 0.4;
  camera.upperRadiusLimit = radius * 6;

  // Zapisanie pozycji startowej do resetu
  initialTarget = center.clone();
  initialRadius = camera.radius;
  initialAlpha = camera.alpha;
  initialBeta = camera.beta;

  

  // Maksymalna jakość tekstur
  scene.textures.forEach(tex => {
    tex.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 16;
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

  // Auto‑rotate
  scene.onBeforeRenderObservable.add(() => {
    if (autoRotate && !userInteracted) {
      camera.alpha += 0.0025;
    }
  });

  // Wykrycie interakcji użytkownika
  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN ||
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      userInteracted = true;
    }
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());

  // --- Funkcje pomocnicze ---

  function setHDRI(type, scene) {
    if (!scene) return;

    const setEnv = (texture) => {
      scene.environmentTexture = texture;
      if (skybox && skybox.material && skybox.material.reflectionTexture) {
        skybox.material.reflectionTexture = texture;
      }
    };

    if (type === "studio") {
      if (!envStudio) return;
      scene.environmentIntensity = 1.0;
      hemiLight.intensity = defaultHemiIntensity;
      dirLight.intensity = defaultDirIntensity;
      setEnv(envStudio);
    }

    if (type === "day") {
      if (!envDay) {
        envDay = BABYLON.CubeTexture.CreateFromPrefilteredData(
          "https://assets.babylonjs.com/environments/environment.env",
          scene
        );
      }
      scene.environmentIntensity = 1.2;
      hemiLight.intensity = 1.0;
      dirLight.intensity = 0.9;
      setEnv(envDay);
    }

    if (type === "night") {
      if (!envNight) {
        envNight = BABYLON.CubeTexture.CreateFromPrefilteredData(
          "https://playground.babylonjs.com/textures/environment.env",
          scene
        );
      }
      scene.environmentIntensity = 0.4;
      hemiLight.intensity = 0.3;
      dirLight.intensity = 0.4;
      setEnv(envNight);
    }

    document.getElementById("envStudioBtn").classList.toggle("active", type === "studio");
    document.getElementById("envDayBtn").classList.toggle("active", type === "day");
    document.getElementById("envNightBtn").classList.toggle("active", type === "night");
  }

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

  document.getElementById("autoCenterBtn").onclick = () => {
    if (!camera || !initialTarget) return;
    camera.setTarget(initialTarget);
  };

  // document.getElementById("toggleGroundBtn").onclick = () => {
  //   if (!ground) return;
  //   ground.isVisible = !ground.isVisible;
  //   document.getElementById("toggleGroundBtn").classList.toggle("active", ground.isVisible);
  // };

  // document.getElementById("toggleLightBtn").onclick = () => {
  //   if (!dirLight) return;
  //   const enabled = dirLight.isEnabled();
  //   dirLight.setEnabled(!enabled);
  //   document.getElementById("toggleLightBtn").classList.toggle("active", !enabled);
  // };

  // document.getElementById("resetLightBtn").onclick = () => {
  //   if (!hemiLight || !dirLight) return;
  //   hemiLight.intensity = defaultHemiIntensity;
  //   dirLight.intensity = defaultDirIntensity;
  // };

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

  // // HDRI przyciski
  // document.getElementById("envStudioBtn").onclick = () => setHDRI("studio", camera?.getScene());
  // document.getElementById("envDayBtn").onclick = () => setHDRI("day", camera?.getScene());
  // document.getElementById("envNightBtn").onclick = () => setHDRI("night", camera?.getScene());

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
  document.getElementById("viewIso").onclick = () => {
    setCameraPreset(Math.PI / 4, Math.PI / 3, 1.2);
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