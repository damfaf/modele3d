Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlMGRjMTdiYy05YjAwLTQwMGMtOTBlNi1iYzJkMTRjODc0N2UiLCJpZCI6MzcxODcyLCJpYXQiOjE3NjY0MTA3NDF9.UCFfk5FwRksMpQlHBnUEGQIYCX0VBiyYKEGdt5YIjyg";

let initialCameraView = null;

async function init() {
    const viewer = new Cesium.Viewer("cesiumContainer", {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        fullscreenButton: false,
        selectionIndicator: false,

        contextOptions: {
            webgl: { alpha: true }
        }
    });

    const scene = viewer.scene;

    // Wyłączamy tło Cesium
    scene.globe.show = false;
    scene.skyAtmosphere.show = false;
    scene.skyBox = undefined;
    scene.backgroundColor = Cesium.Color.TRANSPARENT;

    try {
        // Ładowanie modelu
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(4266583, {
            modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
                Cesium.Cartesian3.fromDegrees(0, 0)
            ),
        });

        scene.primitives.add(tileset);

        // Ustawiamy kamerę na model
        //await viewer.zoomTo(tileset);

        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
                -0.00021,   // długość geograficzna
                0.00008,   // szerokość geograficzna
                8   // wysokość kamery w metrach
            ),
            orientation: {
                heading: Cesium.Math.toRadians(77),     // obrót w poziomie
                pitch: Cesium.Math.toRadians(-18),     // nachylenie kamery
                roll: 0
            }
        });

        // Zapamiętujemy widok początkowy
        initialCameraView = {
            destination: viewer.camera.positionWC.clone(),
            orientation: {
                heading: viewer.camera.heading,
                pitch: viewer.camera.pitch,
                roll: viewer.camera.roll
            }
        };

        // Styl tilesetu (jeśli istnieje)
        const extras = tileset.asset.extras;
        if (
            Cesium.defined(extras) &&
            Cesium.defined(extras.ion) &&
            Cesium.defined(extras.ion.defaultStyle)
        ) {
            tileset.style = new Cesium.Cesium3DTileStyle(extras.ion.defaultStyle);
        }

        // 🔵 HOTSPOT — jedna kropka
        const hotspot = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(-0.000027, 0.000119, -0.8),
            billboard: {
                image: "entrance.png",
                scale: 0.65,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                show: false   // <-- kluczowe
            }
        });

        // Handler do kliknięć i hoverów
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        // 🔗 Kliknięcie → otwórz panoramę
        handler.setInputAction(function (movement) {
            if (!hotspot.billboard.show) return; // jeśli ukryty → ignoruj

            const picked = viewer.scene.pick(movement.position);
            if (Cesium.defined(picked) && picked.id === hotspot) {
                window.open("pano/pano1.html", "_blank");
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  

        MIN_SCALE = 0.8
        MAX_SCALE = 1.1

        // --- TOGGLE HOTSPOT ---
        const toggle = document.getElementById("hotspotToggle");
        let hotspotVisible = false;

        document.querySelector(".toggle-label").addEventListener("click", () => {
            toggle.click();
        });


        toggle.addEventListener("click", () => {
            hotspotVisible = !hotspotVisible;

            // przełącz wygląd suwaka
            toggle.classList.toggle("on", hotspotVisible);

            // przełącz widoczność kropki
            hotspot.billboard.show = hotspotVisible;

            // reset skali po ponownym włączeniu
            if (hotspotVisible) {
                hotspot.billboard.scale = MIN_SCALE;
            }
        });

        // 🟦 Interaktywny hover (powiększanie kropki)
        handler.setInputAction(function (movement) {
        if (!hotspot.billboard.show) {
            viewer._container.style.cursor = "default";
            return;
        }

        const picked = viewer.scene.pick(movement.endPosition);

        if (Cesium.defined(picked) && picked.id === hotspot) {
            hotspot.billboard.scale = MAX_SCALE;
            viewer._container.style.cursor = "pointer";   // 🔥 kursor jak link
        } else {
            hotspot.billboard.scale = MIN_SCALE;
            viewer._container.style.cursor = "default";   // wraca do normalnego
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);



        // Reset widoku
        document.getElementById("resetViewBtn").addEventListener("click", () => {
            if (!initialCameraView) return;

            viewer.camera.flyTo({
                destination: initialCameraView.destination,
                orientation: initialCameraView.orientation,
                easingFunction: Cesium.EasingFunction.SINUSOIDAL_OUT,
                duration: 2.2
            });
        });

    } catch (error) {
        console.error("Błąd ładowania modelu:", error);
    }
}

init();



