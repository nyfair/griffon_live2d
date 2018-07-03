MODELS = ['88type_1809','95type_405','dsr50_1801','dsr50_2101','g36c_1202','hk416_805','kp31_310','m1928a1_1501','mlemk1_604','rfb_1601','vector_1901','welrod_1401']

// シーン生成
var scene = new THREE.Scene();
// カメラ生成
var camera = new THREE.PerspectiveCamera( 72, window.innerWidth/window.innerHeight );
camera.position.z = 4;

// レンダラー生成
var renderer = new THREE.WebGLRenderer();
// レンダラーのサイズ指定
renderer.setSize( window.innerWidth, window.innerHeight );
// DOMを追加
document.body.appendChild( renderer.domElement );

// オフスクリーン用(Live2Dを描画)
var offScene1 = new THREE.Scene();
var offScene2 = new THREE.Scene();
var offRenderTarget1 = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    }
);
var offRenderTarget2 = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    }
);

var MODEL = MODELS[Math.floor(Math.random() * MODELS.length)];
// Live2Dモデルパス
var MODEL_PATH1 = "dabao/live2d/gun/" + MODEL + "/normal/";
var MODEL_PATH2 = "dabao/live2d/gun/" + MODEL + "/destroy/";
// Live2Dモデル生成
var live2dmodel1 = new THREE.Live2DRender( renderer, MODEL_PATH1, "model.json");
var live2dmodel2 = new THREE.Live2DRender( renderer, MODEL_PATH2, "model.json");

// オフスクリーンを描画するPlane生成
var geometry1 = new THREE.PlaneGeometry( 6, 6, 1, 1 );
// レンダーテクスチャをテクスチャにする
var material1 = new THREE.MeshBasicMaterial( { map:offRenderTarget1.texture } );
var plane1 = new THREE.Mesh( geometry1, material1 );
// この1行がないと透過部分が抜けない
plane1.material.transparent = true;
plane1.position.x = -3;
plane1.position.y = 0;
// イベントリスナーを使えるようにする
THREE.EventDispatcher.call(plane1);
scene.add( plane1 );

// オフスクリーンを描画するPlane生成
var geometry2 = new THREE.PlaneGeometry( 6, 6, 1, 1 );
// レンダーテクスチャをテクスチャにする
var material2 = new THREE.MeshBasicMaterial( { map:offRenderTarget2.texture } );
var plane2 = new THREE.Mesh( geometry2, material2 );
// この1行がないと透過部分が抜けない
plane2.material.transparent = true;
plane2.position.x = 3;
plane2.position.y = 0;
// イベントリスナーを使えるようにする
THREE.EventDispatcher.call(plane2);
scene.add( plane2 );

// リサイズへの対応
window.addEventListener('resize', function() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    // オフスクリーンのレンダーターゲットもリサイズ
    offRenderTarget1.setSize( window.innerWidth, window.innerHeight );
    offRenderTarget2.setSize( window.innerWidth, window.innerHeight );
    // マウスドラッグ座標もリサイズ
    live2dmodel1.setMouseView(renderer);
    live2dmodel2.setMouseView(renderer);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}, false);

document.addEventListener('mousedown', function(e) {
    switch(e.button) {
    case 0:
        live2dmodel1.setRandomMotion();
        live2dmodel2.setRandomMotion();
        break;
    case 1:
        MODEL = MODELS[Math.floor(Math.random() * MODELS.length)];
        MODEL_PATH1 = "dabao/live2d/gun/" + MODEL + "/normal/";
        MODEL_PATH2 = "dabao/live2d/gun/" + MODEL + "/destroy/";
        live2dmodel1 = new THREE.Live2DRender( renderer, MODEL_PATH1, "model.json");
        live2dmodel2 = new THREE.Live2DRender( renderer, MODEL_PATH2, "model.json");
    }
}, false);

document.addEventListener("keydown", function(e){
    switch(e.which) {
    case 87:
        camera.position.y -= 0.02;
        break;
    case 83:
        camera.position.y += 0.02;
        break
    case 65:
        camera.position.x += 0.02;
        break
    case 68:
        camera.position.x -= 0.02;
        break
    case 81:
        camera.position.z -= 0.02;
        break
    case 69:
        camera.position.z += 0.02;
    }
    
}, false);

/**
 * 描画処理
 */
var render = function () {
    requestAnimationFrame( render );
    // オフスクリーン切り替え描画
    renderer.render( offScene1, camera, offRenderTarget1 );
    // オフスクリーンにLive2D描画
    live2dmodel1.draw();
    // オフスクリーン切り替え描画
    renderer.render( offScene2, camera, offRenderTarget2 );
    // オフスクリーンにLive2D描画
    live2dmodel2.draw();
    // resetGLStateしないとgl.useProgramが呼ばれず以下のエラーになる
    // [error]location is not from current program
    renderer.state.reset();
    // Mainシーンで描画
    renderer.render( scene, camera );
};

render();