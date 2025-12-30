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
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(4308395, {
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

