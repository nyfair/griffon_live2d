/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class PlatformManager     extend IPlatformManager
//============================================================
//============================================================
function PlatformManager()
{

}

//============================================================
//    PlatformManager # loadBytes()
//============================================================
PlatformManager.prototype.loadBytes       = function(path/*String*/, callback)
{
    var request = new XMLHttpRequest();
    request.open("GET", path, true);
    request.responseType = "arraybuffer";
    request.onload = function(){
        switch(request.status){
        case 200:
            callback(request.response);
            break;
        default:
            console.error("Failed to load (" + request.status + ") : " + path);
            break;
        }
    }
    request.send(null);
    //return request;
}

//============================================================
//    PlatformManager # loadString()
//============================================================
PlatformManager.prototype.loadString      = function(path/*String*/)
{
    
    this.loadBytes(path, function(buf) {        
        return buf;
    });
    
}

//============================================================
//    PlatformManager # loadLive2DModel()
//============================================================
PlatformManager.prototype.loadLive2DModel = function(path/*String*/, callback)
{
    var model = null;
    
    // load moc
    this.loadBytes(path, function(buf){
        model = Live2DModelWebGL.loadModel(buf);
        callback(model);
    });

}

//============================================================
//    PlatformManager # loadTexture()
//============================================================
PlatformManager.prototype.loadTexture     = function(model/*ALive2DModel*/, no/*int*/, path/*String*/, callback)
{ 
    // load textures
    var loadedImage = new Image();
    loadedImage.src = path;
        
    var thisRef = this;
    loadedImage.onload = function() {
                
        // create texture
        var canvas = document.getElementById("glcanvas");
        var gl = getWebGLContext(canvas, {premultipliedAlpha : true});
        var texture = gl.createTexture();	 // テクスチャオブジェクトを作成する
        if (!texture){ console.error("Failed to generate gl texture name."); return -1; }

        if(model.isPremultipliedAlpha() == false){
            // 乗算済アルファテクスチャ以外の場合
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);	// imageを上下反転
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, 
                      gl.UNSIGNED_BYTE, loadedImage);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);


        // 画像からWebGLテクスチャ化を生成し、モデルに登録
        model.setTexture(no, texture);// モデルにテクスチャをセット
        
        // テクスチャオブジェクトを解放
        texture = null;
        
        if (typeof callback == "function") callback();
    };
    
    loadedImage.onerror = function() { 
        console.error("Failed to load image : " + path); 
    }
}


//============================================================
//    PlatformManager # parseFromBytes(buf)
//    ArrayBuffer から JSON に変換する
//============================================================
PlatformManager.prototype.jsonParseFromBytes = function(buf){
    
    var jsonStr;
    
    // BOMの有無に応じて処理を分ける
    // UTF-8のBOMは0xEF 0xBB 0xBF（10進数：239 187 191）
    var bomCode = new Uint8Array(buf, 0, 3);
    if (bomCode[0] == 239 && bomCode[1] == 187 && bomCode[2] == 191) {
        jsonStr = String.fromCharCode.apply(null, new Uint8Array(buf, 3));
    } else {
        jsonStr = String.fromCharCode.apply(null, new Uint8Array(buf));
    }
    
    var jsonObj = JSON.parse(jsonStr);
    
    return jsonObj;
};


//============================================================
//    PlatformManager # log()
//============================================================
PlatformManager.prototype.log             = function(txt/*String*/)
{
    console.log(txt);
}


/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */
//============================================================
//============================================================
//  class L2DBaseModel         
//============================================================
//============================================================
function L2DBaseModel()
{
    this.live2DModel     = null; // ALive2DModel
    this.modelMatrix     = null; // L2DModelMatrix
    this.eyeBlink        = null; // L2DEyeBlink
    this.physics         = null; // L2DPhysics
    this.pose            = null; // L2DPose
    this.debugMode       = false;
    this.initialized     = false;
    this.updating        = false;
    this.alpha           = 1;
    this.accAlpha        = 0;
    this.lipSync         = false; 
    this.lipSyncValue    = 0;     
    this.accelX          = 0;
    this.accelY          = 0;
    this.accelZ          = 0;
    this.dragX           = 0;
    this.dragY           = 0;
    this.startTimeMSec   = null;
    this.mainMotionManager = new L2DMotionManager(); //L2DMotionManager
    this.expressionManager = new L2DMotionManager(); //L2DMotionManager
    this.motions = {};
    this.expressions = {};
    
    this.isTexLoaded = false;
}

var texCounter = 0;

//============================================================
//    L2DBaseModel # getModelMatrix()
//============================================================
L2DBaseModel.prototype.getModelMatrix  = function()
{
    return this.modelMatrix;
}

//============================================================
//    L2DBaseModel # setAlpha()
//============================================================
L2DBaseModel.prototype.setAlpha        = function(a/*float*/)
{
    if( a > 0.999 ) a = 1;
    if( a < 0.001 ) a = 0;
    this.alpha = a;
}

//============================================================
//    L2DBaseModel # getAlpha()
//============================================================
L2DBaseModel.prototype.getAlpha        = function()
{
    return this.alpha;
}

//============================================================
//    L2DBaseModel # isInitialized()
//============================================================
L2DBaseModel.prototype.isInitialized   = function()
{
    return this.initialized;
}

//============================================================
//    L2DBaseModel # setInitialized()
//============================================================
L2DBaseModel.prototype.setInitialized  = function( v/*boolean*/)
{
    this.initialized = v;
}

//============================================================
//    L2DBaseModel # isUpdating()
//============================================================
L2DBaseModel.prototype.isUpdating      = function()
{
    return this.updating;
}

//============================================================
//    L2DBaseModel # setUpdating()
//============================================================
L2DBaseModel.prototype.setUpdating     = function(v/*boolean*/)
{
    this.updating = v;
}

//============================================================
//    L2DBaseModel # getLive2DModel()
//============================================================
L2DBaseModel.prototype.getLive2DModel  = function()
{
    return this.live2DModel;
}

//============================================================
//    L2DBaseModel # setLipSync()
//============================================================
L2DBaseModel.prototype.setLipSync      = function(v/*boolean*/)
{
    this.lipSync = v;
}

//============================================================
//    L2DBaseModel # setLipSyncValue()
//============================================================
L2DBaseModel.prototype.setLipSyncValue = function(v/*float*/)
{
    this.lipSyncValue = v;
}

//============================================================
//    L2DBaseModel # setAccel()
//============================================================
L2DBaseModel.prototype.setAccel        = function(x/*float*/, y/*float*/, z/*float*/)
{
    this.accelX = x;
    this.accelY = y;
    this.accelZ = z;
}

//============================================================
//    L2DBaseModel # setDrag()
//============================================================
L2DBaseModel.prototype.setDrag         = function(x/*float*/, y/*float*/)
{
    this.dragX = x;
    this.dragY = y;
}

//============================================================
//    L2DBaseModel # getMainMotionManager()
//============================================================
L2DBaseModel.prototype.getMainMotionManager = function()
{
    return this.mainMotionManager;
}

//============================================================
//    L2DBaseModel # getExpressionManager()
//============================================================
L2DBaseModel.prototype.getExpressionManager = function()
{
    return this.expressionManager;
}

//============================================================
//    L2DBaseModel # loadModelData()
//============================================================
L2DBaseModel.prototype.loadModelData   = function(path/*String*/, callback)
{   
    /*
    if( this.live2DModel != null ) {
        this.live2DModel.deleteTextures();
    }
    */
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    if( this.debugMode ) pm.log("Load model : " + path);

    var thisRef = this;
    pm.loadLive2DModel(path, function(l2dModel) {
        thisRef.live2DModel = l2dModel;
        thisRef.live2DModel.saveParam();
        
        var _err = Live2D.getError();

        if( _err != 0 ) {
            console.error("Error : Failed to loadModelData().");
            return;
        }
        
        thisRef.modelMatrix = new L2DModelMatrix(
            thisRef.live2DModel.getCanvasWidth(),
            thisRef.live2DModel.getCanvasHeight()); //L2DModelMatrix
        thisRef.modelMatrix.setWidth(2);
        thisRef.modelMatrix.setCenterPosition(0, 0);
        
        callback(thisRef.live2DModel);
    });
}


//============================================================
//    L2DBaseModel # loadTexture()
//============================================================
L2DBaseModel.prototype.loadTexture     = function(no/*int*/, path/*String*/, callback)
{
    texCounter++;
 
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    
    if( this.debugMode ) pm.log("Load Texture : " + path);
    
    var thisRef = this;
    pm.loadTexture(this.live2DModel , no , path, function(){
        texCounter--;
        if(texCounter == 0) thisRef.isTexLoaded = true;
        if (typeof callback == "function") callback();
    });
    
}

//============================================================
//    L2DBaseModel # loadMotion()
//============================================================
L2DBaseModel.prototype.loadMotion      = function(name/*String*/, path /*String*/, callback)
{    
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    
    if(this.debugMode) pm.log("Load Motion : " + path);
    
    var motion = null; //Live2DMotion
    
    var thisRef = this;
    pm.loadBytes(path, function(buf) {
        motion = Live2DMotion.loadMotion(buf);
        if( name != null ) {
            thisRef.motions[name] = motion;
        }
        callback(motion);
    });
    
}

//============================================================
//    L2DBaseModel # loadExpression()
//============================================================
L2DBaseModel.prototype.loadExpression  = function(name/*String*/, path /*String*/, callback)
{
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    
    if( this.debugMode ) pm.log("Load Expression : " + path);
    
    var thisRef = this;
    pm.loadBytes(path, function(buf) {
        if(name != null) {
            thisRef.expressions[name] = L2DExpressionMotion.loadJson(buf);
        }
        if (typeof callback == "function") callback();
    });
}

//============================================================
//    L2DBaseModel # loadPose()
//============================================================
L2DBaseModel.prototype.loadPose = function( path /*String*/, callback )
{
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    if( this.debugMode ) pm.log("Load Pose : " + path);
    var thisRef = this;
    try {
        pm.loadBytes(path, function(buf) {
            thisRef.pose = L2DPose.load(buf);
            if (typeof callback == "function") callback();
        });
    }
    catch(e) {
        console.warn(e);
    }
}

//============================================================
//    L2DBaseModel # loadPhysics()
//============================================================
L2DBaseModel.prototype.loadPhysics     = function(path/*String*/)
{
    var pm = Live2DFramework.getPlatformManager(); //IPlatformManager
    if( this.debugMode ) pm.log("Load Physics : " + path);
    var thisRef = this;
    try {
        pm.loadBytes(path, function(buf) {
            thisRef.physics = L2DPhysics.load(buf);
        });
    }
    catch(e){
        console.warn(e);
    }
}

//============================================================
//    L2DBaseModel # hitTestSimple()
//============================================================
L2DBaseModel.prototype.hitTestSimple = function(drawID, testX, testY)
{   
    var drawIndex = this.live2DModel.getDrawDataIndex(drawID);
    
    if( drawIndex < 0 ) return false;
    
    var points = this.live2DModel.getTransformedPoints(drawIndex);
    var left = this.live2DModel.getCanvasWidth();
    var right = 0;
    var top = this.live2DModel.getCanvasHeight();
    var bottom = 0;
    
    for( var j = 0; j < points.length; j = j + 2 ) {
        var x = points[j];
        var y = points[j + 1];

        if( x < left ) left = x;
        if( x > right ) right = x;
        if( y < top ) top = y;
        if( y > bottom ) bottom = y;
    }
    var tx = this.modelMatrix.invertTransformX(testX);
    var ty = this.modelMatrix.invertTransformY(testY);
    
    return ( left <= tx && tx <= right && top <= ty && ty <= bottom );
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DExpressionMotion  extends     AMotion
//============================================================
//============================================================
function L2DExpressionMotion()
{
    AMotion.prototype.constructor.call(this);
    this.paramList = new Array(); //ArrayList<L2DExpressionParam>
}

L2DExpressionMotion.prototype = new AMotion(); // L2DExpressionMotion extends AMotion

//============================================================
L2DExpressionMotion.EXPRESSION_DEFAULT  = "DEFAULT";
L2DExpressionMotion.TYPE_SET            = 0;
L2DExpressionMotion.TYPE_ADD            = 1;
L2DExpressionMotion.TYPE_MULT           = 2;

//============================================================
//    static L2DExpressionMotion.loadJson()
//============================================================
L2DExpressionMotion.loadJson        = function(buf)
{    
    var ret = new L2DExpressionMotion();
    
    var pm = Live2DFramework.getPlatformManager();
    var json = pm.jsonParseFromBytes(buf);

    ret.setFadeIn(parseInt(json.fade_in) > 0 ? parseInt(json.fade_in) : 1000);
    ret.setFadeOut(parseInt(json.fade_out) > 0 ? parseInt(json.fade_out) : 1000);
    
    if(json.params == null) {
        return ret;
    }
    
    var params = json.params;
    var paramNum = params.length;
    ret.paramList = []; //ArrayList<L2DExpressionParam>
    for( var i = 0; i < paramNum; i++) {
        var param = params[i];
        var paramID = param.id.toString();
        var value = parseFloat(param.val);
        var calcTypeInt = L2DExpressionMotion.TYPE_ADD;
        var calc = param.calc != null ? param.calc.toString() : "add";
        if(calc === "add") {
            calcTypeInt = L2DExpressionMotion.TYPE_ADD;
        }
        else if(calc === "mult") {
            calcTypeInt = L2DExpressionMotion.TYPE_MULT;
        }
        else if(calc === "set") {
            calcTypeInt = L2DExpressionMotion.TYPE_SET;
        }
        else {
            calcTypeInt = L2DExpressionMotion.TYPE_ADD;
        }
        if(calcTypeInt == L2DExpressionMotion.TYPE_ADD) {
            var defaultValue = param.def == null ? 0 : parseFloat(param.def);
            value = value - defaultValue;
        }
        else if(calcTypeInt == L2DExpressionMotion.TYPE_MULT) {
            var defaultValue = param.def == null ? 1 : parseFloat(param.def);
            if(defaultValue == 0 ) defaultValue = 1;
            value = value / defaultValue;
        }
        
        var item = new L2DExpressionParam(  );
        item.id = paramID;
        item.type = calcTypeInt;
        item.value = value;
        
        ret.paramList.push(item);
    }
    
     return ret;
}


//============================================================
//    L2DExpressionMotion # updateParamExe()
//============================================================
L2DExpressionMotion.prototype.updateParamExe  = function(model /*ALive2DModel*/, timeMSec/*long*/ ,weight /*float*/ ,motionQueueEnt /*MotionQueueEnt*/)
{
    for(var i = this.paramList.length - 1; i >= 0; --i) {
        var param = this.paramList[i]; //L2DExpressionParam
        // if (!param || !param.type) continue;
        if(param.type == L2DExpressionMotion.TYPE_ADD) {
            model.addToParamFloat(param.id, param.value, weight);
        }
        else if(param.type == L2DExpressionMotion.TYPE_MULT) {
            model.multParamFloat(param.id, param.value, weight);
        }
        else if(param.type == L2DExpressionMotion.TYPE_SET) {            
            model.setParamFloat(param.id, param.value, weight);
        }
    }
}

//============================================================
//============================================================
//  class L2DExpressionParam   
//============================================================
//============================================================
function L2DExpressionParam()
{
    this.id              = "";
    this.type            = -1;
    this.value           = null;
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DEyeBlink          
//============================================================
//============================================================
function L2DEyeBlink()
{
    this.nextBlinkTime   = null /* TODO NOT INIT */; // 
    this.stateStartTime  = null /* TODO NOT INIT */; // 
    this.blinkIntervalMsec = null /* TODO NOT INIT */; // 
    this.eyeState = EYE_STATE.STATE_FIRST;
    this.blinkIntervalMsec = 4000;
    this.closingMotionMsec = 100;
    this.closedMotionMsec = 50;
    this.openingMotionMsec = 150;
    this.closeIfZero = true;
    this.eyeID_L = "PARAM_EYE_L_OPEN";
    this.eyeID_R = "PARAM_EYE_R_OPEN";
}

//============================================================
//    L2DEyeBlink # calcNextBlink()
//============================================================
L2DEyeBlink.prototype.calcNextBlink   = function()
{
    var time /*long*/ = UtSystem.getUserTimeMSec();
    var r /*Number*/ = Math.random();
    return  /*(long)*/ (time + r * (2 * this.blinkIntervalMsec - 1));
}

//============================================================
//    L2DEyeBlink # setInterval()
//============================================================
L2DEyeBlink.prototype.setInterval     = function(blinkIntervalMsec /*int*/)
{
    this.blinkIntervalMsec = blinkIntervalMsec;
}

//============================================================
//    L2DEyeBlink # setEyeMotion()
//============================================================
L2DEyeBlink.prototype.setEyeMotion    = function(closingMotionMsec/*int*/ , closedMotionMsec/*int*/ , openingMotionMsec/*int*/)
{
    this.closingMotionMsec = closingMotionMsec;
    this.closedMotionMsec = closedMotionMsec;
    this.openingMotionMsec = openingMotionMsec;
}

//============================================================
//    L2DEyeBlink # updateParam()
//============================================================
L2DEyeBlink.prototype.updateParam     = function(model/*ALive2DModel*/)
{
    var time /*:long*/ = UtSystem.getUserTimeMSec();
    var eyeParamValue /*:Number*/;
    var t /*:Number*/ = 0;
    switch(this.eyeState){
    case EYE_STATE.STATE_CLOSING:
        t = (time - this.stateStartTime) / this.closingMotionMsec;
        if(t >= 1) {
            t = 1;
            this.eyeState = EYE_STATE.STATE_CLOSED;
            this.stateStartTime = time;
        }
        eyeParamValue = 1 - t;
        break;
    case EYE_STATE.STATE_CLOSED:
        t = (time - this.stateStartTime) / this.closedMotionMsec;
        if(t >= 1) {
            this.eyeState = EYE_STATE.STATE_OPENING;
            this.stateStartTime = time;
        }
        eyeParamValue = 0;
        break;
    case EYE_STATE.STATE_OPENING:
        t = (time - this.stateStartTime) / this.openingMotionMsec;
        if(t >= 1) {
            t = 1;
            this.eyeState = EYE_STATE.STATE_INTERVAL;
            this.nextBlinkTime = this.calcNextBlink();
        }
        eyeParamValue = t;
        break;
    case EYE_STATE.STATE_INTERVAL:
        if(this.nextBlinkTime < time) {
            this.eyeState = EYE_STATE.STATE_CLOSING;
            this.stateStartTime = time;
        }
        eyeParamValue = 1;
        break;
    case EYE_STATE.STATE_FIRST:
    default:
        this.eyeState = EYE_STATE.STATE_INTERVAL;
        this.nextBlinkTime = this.calcNextBlink();
        eyeParamValue = 1;
        break;
    }
    if(!this.closeIfZero) eyeParamValue = -eyeParamValue;
    model.setParamFloat(this.eyeID_L , eyeParamValue);
    model.setParamFloat(this.eyeID_R , eyeParamValue);
}

//== enum EYE_STATE ==
var EYE_STATE = function(){};

EYE_STATE.STATE_FIRST          = "STATE_FIRST"
EYE_STATE.STATE_INTERVAL       = "STATE_INTERVAL"
EYE_STATE.STATE_CLOSING        = "STATE_CLOSING"
EYE_STATE.STATE_CLOSED         = "STATE_CLOSED"
EYE_STATE.STATE_OPENING        = "STATE_OPENING"
/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DMatrix44          
//============================================================
//============================================================
function L2DMatrix44()
{
    this.tr              = new Float32Array(16); // 
    this.identity();
}

//============================================================
//    static L2DMatrix44.mul()
//============================================================
L2DMatrix44.mul             = function( a/*float[]*/, b/*float[]*/, dst/*float[]*/ )
{
    var c = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    var n = 4;
    var i, j, k;
    for( i = 0; i < n; i++ ) {
        for( j = 0; j < n; j++ ) {
            for( k = 0; k < n; k++ ) {
                c[i + j * 4] += a[i + k * 4] * b[k + j * 4];
            }
        }
    }
    for( i = 0; i < 16; i++ ) {
        dst[i] = c[i];
    }
}

//============================================================
//    L2DMatrix44 # identity()
//============================================================
L2DMatrix44.prototype.identity        = function()
{
    for( var i/*:int*/ = 0; i < 16; i++ ) 
        this.tr[i] = ( ( i % 5 ) == 0 ) ? 1 : 0;
}

//============================================================
//    L2DMatrix44 # getArray()
//============================================================
L2DMatrix44.prototype.getArray        = function()
{
    return this.tr;
}

//============================================================
//    L2DMatrix44 # getCopyMatrix()
//============================================================
L2DMatrix44.prototype.getCopyMatrix   = function()
{
    return new Float32Array(this.tr); // this.tr.clone();
}

//============================================================
//    L2DMatrix44 # setMatrix()
//============================================================
L2DMatrix44.prototype.setMatrix       = function( tr/*float[]*/ )
{
    if( this.tr == null || this.tr.length != this.tr.length ) return ;
    for( var i/*:int*/ = 0; i < 16; i++ ) this.tr[i] = tr[i];
}

//============================================================
//    L2DMatrix44 # getScaleX()
//============================================================
L2DMatrix44.prototype.getScaleX       = function()
{
    return this.tr[0];
}

//============================================================
//    L2DMatrix44 # getScaleY()
//============================================================
L2DMatrix44.prototype.getScaleY       = function()
{
    return this.tr[5];
}

//============================================================
//    L2DMatrix44 # transformX()
//============================================================
L2DMatrix44.prototype.transformX      = function( src/*float*/ )
{
    return this.tr[0] * src + this.tr[12];
}

//============================================================
//    L2DMatrix44 # transformY()
//============================================================
L2DMatrix44.prototype.transformY      = function( src/*float*/ )
{
    return this.tr[5] * src + this.tr[13];
}

//============================================================
//    L2DMatrix44 # invertTransformX()
//============================================================
L2DMatrix44.prototype.invertTransformX = function( src/*float*/ )
{
    return ( src - this.tr[12] ) / this.tr[0];
}

//============================================================
//    L2DMatrix44 # invertTransformY()
//============================================================
L2DMatrix44.prototype.invertTransformY = function( src/*float*/ )
{
    return ( src - this.tr[13] ) / this.tr[5];
}

//============================================================
//    L2DMatrix44 # multTranslate()
//============================================================
L2DMatrix44.prototype.multTranslate   = function( shiftX/*float*/, shiftY/*float*/ )
{
    var tr1 = [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, shiftX, shiftY, 0, 1 ];
    L2DMatrix44.mul(tr1, this.tr, this.tr);
}

//============================================================
//    L2DMatrix44 # translate()
//============================================================
L2DMatrix44.prototype.translate       = function( x/*float*/, y/*float*/ )
{
    this.tr[12] = x;
    this.tr[13] = y;
}

//============================================================
//    L2DMatrix44 # translateX()
//============================================================
L2DMatrix44.prototype.translateX      = function( x/*float*/ )
{
    this.tr[12] = x;
}

//============================================================
//    L2DMatrix44 # translateY()
//============================================================
L2DMatrix44.prototype.translateY      = function( y/*float*/ )
{
    this.tr[13] = y;
}

//============================================================
//    L2DMatrix44 # multScale()
//============================================================
L2DMatrix44.prototype.multScale       = function( scaleX/*float*/, scaleY/*float*/ )
{
    var tr1 = [scaleX, 0, 0, 0, 0, scaleY, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    L2DMatrix44.mul(tr1, this.tr, this.tr);
}

//============================================================
//    L2DMatrix44 # scale()
//============================================================
L2DMatrix44.prototype.scale           = function( scaleX/*float*/, scaleY/*float*/ )
{
    this.tr[0] = scaleX;
    this.tr[5] = scaleY;
}
/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DModelMatrix       extends     L2DMatrix44
//============================================================
//============================================================
function L2DModelMatrix(w/*float*/, h/*float*/){
    L2DMatrix44.prototype.constructor.call(this);
    this.width = w;
    this.height = h;
}

//L2DModelMatrix extends L2DMatrix44
L2DModelMatrix.prototype = new L2DMatrix44(); 

//============================================================
//    L2DModelMatrix # setPosition()
//============================================================
L2DModelMatrix.prototype.setPosition     = function(x/*float*/, y/*float*/)
{
    this.translate(x, y);
}

//============================================================
//    L2DModelMatrix # setCenterPosition()
//============================================================
L2DModelMatrix.prototype.setCenterPosition = function(x/*float*/, y/*float*/)
{
    var w = this.width * this.getScaleX();
    var h = this.height * this.getScaleY();
    this.translate(x - w / 2, y - h / 2);
}

//============================================================
//    L2DModelMatrix # top()
//============================================================
L2DModelMatrix.prototype.top             = function(y/*float*/)
{
    this.setY(y);
}

//============================================================
//    L2DModelMatrix # bottom()
//============================================================
L2DModelMatrix.prototype.bottom          = function(y/*float*/)
{
    var h = this.height * this.getScaleY();
    this.translateY(y - h);
}

//============================================================
//    L2DModelMatrix # left()
//============================================================
L2DModelMatrix.prototype.left            = function(x/*float*/)
{
    this.setX(x);
}

//============================================================
//    L2DModelMatrix # right()
//============================================================
L2DModelMatrix.prototype.right           = function(x/*float*/)
{
    var w = this.width * this.getScaleX();
    this.translateX(x - w);
}

//============================================================
//    L2DModelMatrix # centerX()
//============================================================
L2DModelMatrix.prototype.centerX         = function(x/*float*/)
{
    var w = this.width * this.getScaleX();
    this.translateX(x - w / 2);
}

//============================================================
//    L2DModelMatrix # centerY()
//============================================================
L2DModelMatrix.prototype.centerY         = function(y/*float*/)
{
    var h = this.height * this.getScaleY();
    this.translateY(y - h / 2);
}

//============================================================
//    L2DModelMatrix # setX()
//============================================================
L2DModelMatrix.prototype.setX            = function(x/*float*/)
{
    this.translateX(x);
}

//============================================================
//    L2DModelMatrix # setY()
//============================================================
L2DModelMatrix.prototype.setY            = function(y/*float*/)
{
    this.translateY(y);
}

//============================================================
//    L2DModelMatrix # setHeight()
//============================================================
L2DModelMatrix.prototype.setHeight       = function(h/*float*/)
{
    var scaleX = h / this.height;
    var scaleY = -scaleX;
    this.scale(scaleX, scaleY);
}

//============================================================
//    L2DModelMatrix # setWidth()
//============================================================
L2DModelMatrix.prototype.setWidth        = function(w/*float*/)
{
    var scaleX = w / this.width;
    var scaleY = -scaleX;
    this.scale(scaleX, scaleY);
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DMotionManager     extends     MotionQueueManager
//============================================================
//============================================================
function L2DMotionManager()
{
    MotionQueueManager.prototype.constructor.call(this);
    this.currentPriority = null;
    this.reservePriority = null;
    
    this.super = MotionQueueManager.prototype;
}


L2DMotionManager.prototype = new MotionQueueManager();

//============================================================
//    L2DMotionManager # getCurrentPriority()
//============================================================
L2DMotionManager.prototype.getCurrentPriority = function()
{
    return this.currentPriority;
}

//============================================================
//    L2DMotionManager # getReservePriority()
//============================================================
L2DMotionManager.prototype.getReservePriority = function()
{
    return this.reservePriority;
}

//============================================================
//    L2DMotionManager # reserveMotion()
//============================================================
L2DMotionManager.prototype.reserveMotion   = function(priority/*int*/)
{
    if(this.reservePriority >= priority) {
        return false;
    }
    if(this.currentPriority >= priority) {
        return false;
    }
    
    this.reservePriority = priority;
    
    return true;
}

//============================================================
//    L2DMotionManager # setReservePriority()
//============================================================
L2DMotionManager.prototype.setReservePriority = function(val/*int*/)
{
    this.reservePriority = val;
}

//============================================================
//    L2DMotionManager # updateParam()
//============================================================
L2DMotionManager.prototype.updateParam     = function(model/*ALive2DModel*/)
{
    var updated = MotionQueueManager.prototype.updateParam.call(this, model);
    
    if(this.isFinished()) {
        this.currentPriority = 0;
    }
    
    return updated;
}

//============================================================
//    L2DMotionManager # startMotionPrio()
//============================================================
L2DMotionManager.prototype.startMotionPrio = function(motion/*AMotion*/, priority/*int*/)
{
    if(priority == this.reservePriority) {
        this.reservePriority = 0;
    }
    this.currentPriority = priority;
    return this.startMotion(motion, false);
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DPhysics           
//============================================================
//============================================================
function L2DPhysics()
{ 
    this.physicsList = new Array(); //ArrayList<PhysicsHair>
    this.startTimeMSec = UtSystem.getUserTimeMSec();
}

//============================================================
//    static L2DPhysics.load()
//============================================================
L2DPhysics.load            = function(buf /*byte[]*/ )
{
    var ret = new L2DPhysics(); //L2DPhysicsL2DPhysics
    var pm = Live2DFramework.getPlatformManager();
    var json = pm.jsonParseFromBytes(buf);
    var params = json.physics_hair;
    var paramNum = params.length;
    for(var i = 0; i < paramNum; i++) {
        var param = params[i]; //Value
        var physics = new PhysicsHair(); //PhysicsHairPhysicsHair
        var setup = param.setup; //Value
        var length = parseFloat(setup.length);
        var resist = parseFloat(setup.regist);
        var mass = parseFloat(setup.mass);
        physics.setup(length, resist, mass);
        var srcList = param.src; //Value
        var srcNum = srcList.length;
        for(var j = 0; j < srcNum; j++) {
            var src = srcList[j]; //Value
            var id = src.id; //String
            var type = PhysicsHair.Src.SRC_TO_X;
            var typeStr = src.ptype; //String
            if(typeStr === "x") {
                type = PhysicsHair.Src.SRC_TO_X;
            }
            else if(typeStr === "y") {
                type = PhysicsHair.Src.SRC_TO_Y;
            }
            else if(typeStr === "angle") {
                type = PhysicsHair.Src.SRC_TO_G_ANGLE;
            }
            else {
                UtDebug.error("live2d", "Invalid parameter:PhysicsHair.Src");
            }
            var scale = parseFloat(src.scale);
            var weight = parseFloat(src.weight);
            physics.addSrcParam(type, id, scale, weight);
        }
        var targetList = param.targets; //Value
        var targetNum = targetList.length;
        for(var j = 0; j < targetNum; j++) {
            var target = targetList[j]; //Value
            var id = target.id; //String
            var type = PhysicsHair.Target.TARGET_FROM_ANGLE;
            var typeStr = target.ptype; //String
            if(typeStr === "angle") {
                type = PhysicsHair.Target.TARGET_FROM_ANGLE;
            }
            else if(typeStr === "angle_v") {
                type = PhysicsHair.Target.TARGET_FROM_ANGLE_V;
            }
            else {
                UtDebug.error("live2d", "Invalid parameter:PhysicsHair.Target");
            }
            var scale = parseFloat(target.scale);
            var weight = parseFloat(target.weight);
            physics.addTargetParam(type, id, scale, weight);
        }
        ret.physicsList.push(physics);
    }
    return ret;
}

//============================================================
//    L2DPhysics # updateParam()
//============================================================
L2DPhysics.prototype.updateParam     = function(model/*ALive2DModel*/)
{
    var timeMSec = UtSystem.getUserTimeMSec() - this.startTimeMSec;
    for(var i = 0; i < this.physicsList.length; i++) {
        this.physicsList[i].update(model, timeMSec);
    }
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DPose              
//============================================================
//============================================================
function L2DPose()
{
    this.lastTime        = 0;
    this.lastModel       = null; //ALive2DModel
    this.partsGroups = new Array(); //ArrayList<L2DPartsParam[]>
}


//============================================================
//    static L2DPose.load()
//============================================================
L2DPose.load            = function(buf/*byte[]*/)
{    
    var ret = new L2DPose(); //L2DPose
    var pm = Live2DFramework.getPlatformManager();
    var json = pm.jsonParseFromBytes(buf);
    var poseListInfo = json.parts_visible; //Value
    var poseNum = poseListInfo.length;
    for(var i_pose = 0; i_pose < poseNum; i_pose++) {
        var poseInfo = poseListInfo[i_pose]; //Value
        var idListInfo = poseInfo.group; //Value
        var idNum = idListInfo.length;
        var partsGroup/*L2DPartsParam*/ = new Array();
        for(var i_group = 0; i_group < idNum; i_group++) {
            var partsInfo = idListInfo[i_group]; //Value
            var parts = new L2DPartsParam(partsInfo.id); //L2DPartsParamL2DPartsParam
            partsGroup[i_group] = parts;
            if(partsInfo.link == null) continue;
            var linkListInfo = partsInfo.link; //Value
            var linkNum = linkListInfo.length;
            parts.link = new Array(); //ArrayList<L2DPartsParam>
            for(var i_link = 0; i_link < linkNum; i_link++) {
                var linkParts = new L2DPartsParam(linkListInfo[i_link]); //L2DPartsParamL2DPartsParam
                parts.link.push(linkParts);
            }
        }
        ret.partsGroups.push(partsGroup);
    }
    
    return ret;
}

//============================================================
//    L2DPose # updateParam()
//============================================================
L2DPose.prototype.updateParam     = function(model/*ALive2DModel*/)
{
    if(model == null) return ;
    
    if(!(model == this.lastModel)) {
        this.initParam(model);
    }
    this.lastModel = model;
    
    var curTime = UtSystem.getUserTimeMSec();
    var deltaTimeSec = ((this.lastTime == 0) ? 0 : (curTime - this.lastTime) / 1000.0);
    this.lastTime = curTime;
    if(deltaTimeSec < 0) deltaTimeSec = 0;
    for(var i = 0; i < this.partsGroups.length; i++) {
        this.normalizePartsOpacityGroup(model, this.partsGroups[i], deltaTimeSec);
        this.copyOpacityOtherParts(model, this.partsGroups[i]);
    }
}

//============================================================
//    L2DPose # initParam()
//============================================================
L2DPose.prototype.initParam       = function(model/*ALive2DModel*/)
{
    if(model == null) return ;
    for(var i = 0; i < this.partsGroups.length; i++) {
        var partsGroup = this.partsGroups[i]; //L2DPartsParam
        for(var j = 0; j < partsGroup.length; j++) {
            partsGroup[j].initIndex(model);
            var partsIndex = partsGroup[j].partsIndex;
            var paramIndex = partsGroup[j].paramIndex;
            if(partsIndex < 0) continue;
            var v/*:Boolean*/ = (model.getParamFloat(paramIndex) != 0);
            model.setPartsOpacity(partsIndex, (v ? 1.0 : 0.0));
            model.setParamFloat(paramIndex, (v ? 1.0 : 0.0));
            if(partsGroup[j].link == null) continue;
            for(var k = 0; k < partsGroup[j].link.length; k++) {
                partsGroup[j].link[k].initIndex(model);
            }
        }
    }
}

//============================================================
//    L2DPose # normalizePartsOpacityGroup()
//============================================================
L2DPose.prototype.normalizePartsOpacityGroup = function(model/*ALive2DModel*/, partsGroup/*L2DPartsParam[]*/, deltaTimeSec/*float*/)
{
    var visibleParts = -1;
    var visibleOpacity = 1.0;
    var CLEAR_TIME_SEC = 0.5;
    var phi = 0.5;
    var maxBackOpacity = 0.15;
    for(var i = 0; i < partsGroup.length; i++) {
        var partsIndex = partsGroup[i].partsIndex;
        var paramIndex = partsGroup[i].paramIndex;
        if(partsIndex < 0) continue;if(model.getParamFloat(paramIndex) != 0) {
            if(visibleParts >= 0) {
                break;
            }
            visibleParts = i;
            visibleOpacity = model.getPartsOpacity(partsIndex);
            visibleOpacity += deltaTimeSec / CLEAR_TIME_SEC;
            if(visibleOpacity > 1) {
                visibleOpacity = 1;
            }
        }
    }
    if(visibleParts < 0) {
        visibleParts = 0;
        visibleOpacity = 1;
    }
    for(var i = 0; i < partsGroup.length; i++) {
        var partsIndex = partsGroup[i].partsIndex;
        if(partsIndex < 0) continue;if(visibleParts == i) {
            model.setPartsOpacity(partsIndex, visibleOpacity);
        }
        else {
            var opacity = model.getPartsOpacity(partsIndex);
            var a1;
            if(visibleOpacity < phi) {
                a1 = visibleOpacity * (phi - 1) / phi + 1;
            }
            else {
                a1 = (1 - visibleOpacity) * phi / (1 - phi);
            }
            var backOp = (1 - a1) * (1 - visibleOpacity);
            if(backOp > maxBackOpacity) {
                a1 = 1 - maxBackOpacity / (1 - visibleOpacity);
            }
            if(opacity > a1) {
                opacity = a1;
            }
            model.setPartsOpacity(partsIndex, opacity);
        }
    }
}

//============================================================
//    L2DPose # copyOpacityOtherParts()
//============================================================
L2DPose.prototype.copyOpacityOtherParts = function(model/*ALive2DModel*/, partsGroup/*L2DPartsParam[]*/)
{
    for(var i_group = 0; i_group < partsGroup.length; i_group++) {
        var partsParam = partsGroup[i_group]; //L2DPartsParam
        if(partsParam.link == null) continue;
        if(partsParam.partsIndex < 0) continue;
        var opacity = model.getPartsOpacity(partsParam.partsIndex);
        for(var i_link = 0; i_link < partsParam.link.length; i_link++) {
            var linkParts = partsParam.link[i_link]; //L2DPartsParam
            if(linkParts.partsIndex < 0) continue;
            model.setPartsOpacity(linkParts.partsIndex, opacity);
        }
    }
}

//============================================================
//============================================================
//  class L2DPartsParam        
//============================================================
//============================================================
function L2DPartsParam(id/*String*/){
    this.paramIndex      = -1;
    this.partsIndex      = -1; 
    this.link            = null; // ArrayList<L2DPartsParam>
    this.id = id;
}

//============================================================
//    L2DPartsParam # initIndex()
//============================================================
L2DPartsParam.prototype.initIndex       = function(model/*ALive2DModel*/)
{   
    this.paramIndex = model.getParamIndex("VISIBLE:" + this.id);
    this.partsIndex = model.getPartsDataIndex(PartsDataID.getID(this.id));
    model.setParamFloat(this.paramIndex, 1);
}
/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DTargetPoint       
//============================================================
//============================================================
function L2DTargetPoint()
{
    this.EPSILON         = 0.01; // 変化の最小値（この値以下は無視される）
    this.faceTargetX     = 0;
    this.faceTargetY     = 0;
    this.faceX           = 0;
    this.faceY           = 0;
    this.faceVX          = 0;
    this.faceVY          = 0;
    this.lastTimeSec     = 0;
}

//============================================================
L2DTargetPoint.FRAME_RATE  = 30;

//============================================================
//    L2DTargetPoint # set()
//============================================================
L2DTargetPoint.prototype.setPoint = function(x/*float*/, y/*float*/)
{
    this.faceTargetX = x;
    this.faceTargetY = y;
}

//============================================================
//    L2DTargetPoint # getX()
//============================================================
L2DTargetPoint.prototype.getX            = function()
{
    return this.faceX;
}

//============================================================
//    L2DTargetPoint # getY()
//============================================================
L2DTargetPoint.prototype.getY            = function()
{
    return this.faceY;
}

//============================================================
//    L2DTargetPoint # update()
//============================================================
L2DTargetPoint.prototype.update          = function()
{
   var TIME_TO_MAX_SPEED = 0.15;
   var FACE_PARAM_MAX_V = 40.0 / 7.5;
   var MAX_V = FACE_PARAM_MAX_V / L2DTargetPoint.FRAME_RATE;
    if(this.lastTimeSec == 0) {
        this.lastTimeSec = UtSystem.getUserTimeMSec();
        return;
    }
    var curTimeSec = UtSystem.getUserTimeMSec();
    var deltaTimeWeight = (curTimeSec - this.lastTimeSec) * L2DTargetPoint.FRAME_RATE / 1000.0;
    this.lastTimeSec = curTimeSec;
   var FRAME_TO_MAX_SPEED = TIME_TO_MAX_SPEED * L2DTargetPoint.FRAME_RATE;
   var MAX_A = deltaTimeWeight * MAX_V / FRAME_TO_MAX_SPEED;
    var dx = (this.faceTargetX - this.faceX);
    var dy = (this.faceTargetY - this.faceY);
    // if(dx == 0 && dy == 0) return;
    if( Math.abs(dx) <= this.EPSILON && Math.abs(dy) <= this.EPSILON ) return;
    var d = Math.sqrt(dx * dx + dy * dy);
    var vx = MAX_V * dx / d;
    var vy = MAX_V * dy / d;
    var ax = vx - this.faceVX;
    var ay = vy - this.faceVY;
    var a =  Math.sqrt(ax * ax + ay * ay);
    if(a < -MAX_A || a > MAX_A) {
        ax *= MAX_A / a;
        ay *= MAX_A / a;
        a = MAX_A;
    }
    this.faceVX += ax;
    this.faceVY += ay;
    {
        var max_v = 0.5 * ( Math.sqrt(MAX_A * MAX_A + 16 * MAX_A * d - 8 * MAX_A * d) - MAX_A);
        var cur_v =  Math.sqrt(this.faceVX * this.faceVX + this.faceVY * this.faceVY);
        if(cur_v > max_v) {
            this.faceVX *= max_v / cur_v;
            this.faceVY *= max_v / cur_v;
        }
    }
    this.faceX += this.faceVX;
    this.faceY += this.faceVY;
}
/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class L2DViewMatrix        extends     L2DMatrix44
//============================================================
//============================================================
function L2DViewMatrix()
{
    L2DMatrix44.prototype.constructor.call(this);
    this.screenLeft      = null;
    this.screenRight     = null;
    this.screenTop       = null;
    this.screenBottom    = null;
    this.maxLeft         = null;
    this.maxRight        = null;
    this.maxTop          = null;
    this.maxBottom       = null;
    this.max = Number.MAX_VALUE;
    this.min = 0;
}

L2DViewMatrix.prototype = new L2DMatrix44(); //L2DViewMatrix extends L2DMatrix44

//============================================================
//    L2DViewMatrix # getMaxScale()
//============================================================
L2DViewMatrix.prototype.getMaxScale     = function()
{
    return this.max;
}

//============================================================
//    L2DViewMatrix # getMinScale()
//============================================================
L2DViewMatrix.prototype.getMinScale     = function()
{
    return this.min;
}

//============================================================
//    L2DViewMatrix # setMaxScale()
//============================================================
L2DViewMatrix.prototype.setMaxScale     = function(v/*float*/)
{
    this.max = v;
}

//============================================================
//    L2DViewMatrix # setMinScale()
//============================================================
L2DViewMatrix.prototype.setMinScale     = function(v/*float*/)
{
    this.min = v;
}

//============================================================
//    L2DViewMatrix # isMaxScale()
//============================================================
L2DViewMatrix.prototype.isMaxScale      = function()
{
    return this.getScaleX() == this.max;
}

//============================================================
//    L2DViewMatrix # isMinScale()
//============================================================
L2DViewMatrix.prototype.isMinScale      = function()
{
    return this.getScaleX() == this.min;
}

//============================================================
//    L2DViewMatrix # adjustTranslate()
//============================================================
L2DViewMatrix.prototype.adjustTranslate = function(shiftX/*float*/, shiftY/*float*/)
{
    if(this.tr[0] * this.maxLeft + (this.tr[12] + shiftX) > this.screenLeft) 
        shiftX = this.screenLeft - this.tr[0] * this.maxLeft - this.tr[12];
    if(this.tr[0] * this.maxRight + (this.tr[12] + shiftX) < this.screenRight) 
        shiftX = this.screenRight - this.tr[0] * this.maxRight - this.tr[12];
    if(this.tr[5] * this.maxTop + (this.tr[13] + shiftY) < this.screenTop) 
        shiftY = this.screenTop - this.tr[5] * this.maxTop - this.tr[13];
    if(this.tr[5] * this.maxBottom + (this.tr[13] + shiftY) > this.screenBottom) 
        shiftY = this.screenBottom - this.tr[5] * this.maxBottom - this.tr[13];
    
    var tr1 = [1, 0, 0, 0, 
               0, 1, 0, 0,
               0, 0, 1, 0, 
               shiftX, shiftY, 0, 1 ];
    L2DMatrix44.mul(tr1, this.tr, this.tr);
}

//============================================================
//    L2DViewMatrix # adjustScale()
//============================================================
L2DViewMatrix.prototype.adjustScale     = function(cx/*float*/, cy/*float*/, scale/*float*/)
{
    var targetScale = scale * this.tr[0];
    if(targetScale < this.min) {
        if(this.tr[0] > 0) scale = this.min / this.tr[0];
    }
    else if(targetScale > this.max) {
        if(this.tr[0] > 0) scale = this.max / this.tr[0];
    }
    var tr1 = [1, 0, 0, 0, 
               0, 1, 0, 0, 
               0, 0, 1, 0, 
               cx, cy, 0, 1];
    var tr2 = [scale, 0, 0, 0,
               0, scale, 0, 0,
               0, 0, 1, 0, 
               0, 0, 0, 1 ];
    var tr3 = [1, 0, 0, 0, 
               0, 1, 0, 0, 
               0, 0, 1, 0, 
               -cx, -cy, 0, 1 ];
    L2DMatrix44.mul(tr3, this.tr, this.tr);
    L2DMatrix44.mul(tr2, this.tr, this.tr);
    L2DMatrix44.mul(tr1, this.tr, this.tr);
}

//============================================================
//    L2DViewMatrix # setScreenRect()
//============================================================
L2DViewMatrix.prototype.setScreenRect   = function(left/*float*/, right/*float*/, bottom/*float*/, top/*float*/)
{
    this.screenLeft = left;
    this.screenRight = right;
    this.screenTop = top;
    this.screenBottom = bottom;
}

//============================================================
//    L2DViewMatrix # setMaxScreenRect()
//============================================================
L2DViewMatrix.prototype.setMaxScreenRect = function(left/*float*/, right/*float*/, bottom/*float*/, top/*float*/)
{
    this.maxLeft = left;
    this.maxRight = right;
    this.maxTop = top;
    this.maxBottom = bottom;
}

//============================================================
//    L2DViewMatrix # getScreenLeft()
//============================================================
L2DViewMatrix.prototype.getScreenLeft   = function()
{
    return this.screenLeft;
}

//============================================================
//    L2DViewMatrix # getScreenRight()
//============================================================
L2DViewMatrix.prototype.getScreenRight  = function()
{
    return this.screenRight;
}

//============================================================
//    L2DViewMatrix # getScreenBottom()
//============================================================
L2DViewMatrix.prototype.getScreenBottom = function()
{
    return this.screenBottom;
}

//============================================================
//    L2DViewMatrix # getScreenTop()
//============================================================
L2DViewMatrix.prototype.getScreenTop    = function()
{
    return this.screenTop;
}

//============================================================
//    L2DViewMatrix # getMaxLeft()
//============================================================
L2DViewMatrix.prototype.getMaxLeft      = function()
{
    return this.maxLeft;
}

//============================================================
//    L2DViewMatrix # getMaxRight()
//============================================================
L2DViewMatrix.prototype.getMaxRight     = function()
{
    return this.maxRight;
}

//============================================================
//    L2DViewMatrix # getMaxBottom()
//============================================================
L2DViewMatrix.prototype.getMaxBottom    = function()
{
    return this.maxBottom;
}

//============================================================
//    L2DViewMatrix # getMaxTop()
//============================================================
L2DViewMatrix.prototype.getMaxTop       = function()
{
    return this.maxTop;
}

/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

//============================================================
//============================================================
//  class Live2DFramework      
//============================================================
//============================================================
function Live2DFramework()
{
}

//============================================================
Live2DFramework.platformManager  = null;

//============================================================
//    static Live2DFramework.getPlatformManager()
//============================================================
Live2DFramework.getPlatformManager = function()
{
    return Live2DFramework.platformManager;
}

//============================================================
//    static Live2DFramework.setPlatformManager()
//============================================================
Live2DFramework.setPlatformManager = function( platformManager /*IPlatformManager*/ )
{
    Live2DFramework.platformManager = platformManager;
}


/*
 * Live2D描画クラス
 */
THREE.Live2DRender = function(renderer, filepath, filenm, scale) {
    // WebGL ContextのWebGLRenderer
    if(renderer){
        this.gl = renderer.getContext();
    }else{
        console.error("第1引数にrendererを渡して下さい");
        return;
    }
    // モデルファイルパス
    if(filepath){
        this.filepath = filepath;
    }else{
        console.error("第2引数にFilePathを渡して下さい");
        return;
    }
    // Jsonファイル名
    if(filenm){
        this.filenm = filenm;
    }else{
        console.error("第3引数にファイル名を渡して下さい");
        return;
    }
    // Live2DモデルWebGL表示サイズ
    this.modelscale = scale || 2.0;

    // Live2Dモデルのインスタンス
    this.live2DModel = null;
    // モデルのロードが完了したら true
    this.loadLive2DCompleted = false;
    // モデルの初期化が完了したら true
    this.initLive2DCompleted = false;
    // WebGL Image型オブジェクトの配列
    this.loadedImages = [];
    // モーション
    this.motions = [];
    // モーション管理マネジャー
    this.motionMgr = null;
    // モーション番号
    this.motionnm = 0;
    // モーションフラグ
    this.motionflg = false;
    // サウンド
    this.sounds = [];
    // サウンド番号
    this.soundnm = 0;
    // 前に流したサウンド
    this.beforesound = 0;
    // 表情モーション
    this.expressions = [];
    // 表情モーション名
    this.expressionsnm = [];
    // 表情モーション管理マネジャー
    this.expressionManager = null;
    // 表情モーションフラグ
    this.expressionflg = false;
    // 表情モーション番号
    this.expressionnm = 0;
    // Live2Dモデル設定
    this.modelDef = null;
    // フェードイン
    this.fadeines = [];
    // フェードアウト
    this.fadeoutes = [];
    // ポーズ
    this.pose = null;
    // 物理演算
    this.physics = null;
    // ドラッグによるアニメーション管理
    this.dragMgr = null;        /*new L2DTargetPoint();*/
    this.viewMatrix = null;     /*new L2DViewMatrix();*/
    this.projMatrix = null;     /*new L2DMatrix44()*/
    this.deviceToScreen = null; /*new L2DMatrix44();*/
    this.drag = false;          // ドラッグ中かどうか
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragX      = 0;
    this.dragY      = 0;

    // Live2Dの初期化
    Live2D.init();
    Live2DFramework.setPlatformManager(new PlatformManager);
    // OpenGLのコンテキストをセット
    Live2D.setGL(this.gl);
    // Jsonをロード(modelDefをセット)
    this.loadJson();
    // マウスドラッグの座標設定
    this.setMouseView(renderer);

    // マウスドラッグのイベントリスナー
    document.addEventListener("mousedown", this.mouseEvent.bind(this), false);
    document.addEventListener("mousemove", this.mouseEvent.bind(this), false);
    document.addEventListener("mouseup", this.mouseEvent.bind(this), false);
    document.addEventListener("mouseout", this.mouseEvent.bind(this), false); 
};

/*
 * Live2D描画クラスのファンクション
 */
THREE.Live2DRender.prototype = {

    /**
    * WebGLコンテキストを取得・初期化。
    * Live2Dの初期化、描画ループを開始。
    */
    initLoop : function()
    {
        //------------ Live2Dの初期化 ------------
        // コールバック対策用
        var that = this;
        // mocファイルからLive2Dモデルのインスタンスを生成
        this.loadBytes(that.filepath + that.modelDef.model, function(buf){
            that.live2DModel = Live2DModelWebGL.loadModel(buf);
        });

        /********** テクスチャの読み込み **********/
        var loadCount = 0;
        for(var i = 0; i < that.modelDef.textures.length; i++){
            (function ( tno ){// 即時関数で i の値を tno に固定する（onerror用)
                that.loadedImages[tno] = new Image();
                that.loadedImages[tno].src = that.filepath + that.modelDef.textures[tno];
                that.loadedImages[tno].onload = function(){
                    if((++loadCount) == that.modelDef.textures.length) {
                        that.loadLive2DCompleted = true;//全て読み終わった
                    }
                }
                that.loadedImages[tno].onerror = function() {
                    console.log("Failed to load image : " + that.modelDef.textures[tno]);
                }
            })( i );
        }

        /********** モーションの読み込み **********/
        var motion_keys = [];   // モーションキー配列
        var mtn_tag = 0;        // モーションタグ
        var mtn_num = 0;        // モーションカウント
        // keyを取得
        for(var key in that.modelDef.motions){
            // moitons配下のキーを取得
            motion_keys[mtn_tag] = key;
            // 読み込むモーションファイル数を取得
            mtn_num += that.modelDef.motions[motion_keys[mtn_tag]].length;
            mtn_tag++;
        }
        // モーションタグ分ループ
        for(var mtnkey in motion_keys){
            // モーションとサウンドを読み込む(motions配下のタグを読み込む)
            for(var j = 0; j < that.modelDef.motions[motion_keys[mtnkey]].length; j++){
                // モーションの数だけロード
                that.loadBytes(that.filepath + that.modelDef.motions[motion_keys[mtnkey]][j].file, function(buf){
                    that.motions.push(Live2DMotion.loadMotion(buf));
                });
                // サウンドの数だけロード
                if(that.modelDef.motions[motion_keys[mtnkey]][j].sound == null){
                    that.sounds.push("");
                }else{
                    that.sounds.push(new L2DSound(that.filepath + that.modelDef.motions[motion_keys[mtnkey]][j].sound));
                }
                // フェードイン
                if(that.modelDef.motions[motion_keys[mtnkey]][j].fade_in == null){
                    that.fadeines.push("");
                }else{
                    that.fadeines.push(that.modelDef.motions[motion_keys[mtnkey]][j].fade_in);
                }
                // フェードアウト
                if(that.modelDef.motions[motion_keys[mtnkey]][j].fade_out == null){
                    that.fadeoutes.push("");
                }else{
                    that.fadeoutes.push(that.modelDef.motions[motion_keys[mtnkey]][j].fade_out);
                }
            }
        }
        // モーションマネジャーのインスタンス化
        that.motionMgr = new L2DMotionManager();

        /********** 表情モーションの読み込み **********/
        var expression_name = [];   // 表情モーション名の配列
        var expression_file = [];   // 表情モーションファイル名の配列

        // 表情のロード(json内にexpressionsがあるかチェック)
        if(that.modelDef.expressions !== void 0){
            for(var i = 0; i < that.modelDef.expressions.length; i++){
                // 表情モーション名の配列を取得
                expression_name[i] = that.modelDef.expressions[i].name;
                expression_file[i] = that.filepath + that.modelDef.expressions[i].file;
                // 表情ファイルをロード
                that.loadExpression(expression_name[i], expression_file[i]);
            }
        }
        // 表情モーションマネージャーのインスタンス化
        that.expressionManager = new L2DMotionManager();

        // ポーズのロード(json内のposeがあるかチェック)
        if(that.modelDef.pose !== void 0){
            that.loadBytes(that.filepath + that.modelDef.pose, function(buf){
                // ポースクラスのロード
                that.pose = L2DPose.load(buf);
            });
        }

        // 物理演算のロード(json内のphysicsがあるかチェック)
        if(that.modelDef.physics !== void 0){
            that.loadBytes(that.filepath + that.modelDef.physics, function(buf){
                // 物理演算クラスのロード
                that.physics = L2DPhysics.load(buf);
            });
        }
    },
    
    /**
     * Live2Dのドラッグ座標軸
     */
    setMouseView : function(renderer){
        // 3Dバッファの初期化
        var width  = renderer.getSize().width;
        var height = renderer.getSize().height;
        // ビュー行列
        var ratio  = height / width;
        var left   = -1.0;
        var right  =  1.0;
        var bottom = -ratio;
        var top    = ratio;

        // ドラッグ用のクラス
        this.dragMgr = new L2DTargetPoint();
        // Live2DのView座標クラス
        this.viewMatrix = new L2DViewMatrix();

        // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
        this.viewMatrix.setScreenRect(left, right, bottom, top);
        // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
        this.viewMatrix.setMaxScreenRect(-2.0, 2.0, -2.0, 2.0);
        this.viewMatrix.setMaxScale(2.0);
        this.viewMatrix.setMinScale(0.8);

        // Live2Dの座標系クラス
        this.projMatrix = new L2DMatrix44();
        this.projMatrix.multScale(1, (width / height));

        // マウス用スクリーン変換行列
        this.deviceToScreen = new L2DMatrix44();
        this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
        this.deviceToScreen.multScale(2 / width, -2 / width);
    },
    
    /**
    * Live2Dの描画
    */
    draw : function()
    {
        // Live2D初期化
        if( ! this.live2DModel || ! this.loadLive2DCompleted )
            return; //ロードが完了していないので何もしないで返る

        // ロード完了後に初回のみ初期化する
        if( ! this.initLive2DCompleted ){
            this.initLive2DCompleted = true;

            // 画像からWebGLテクスチャを生成し、モデルに登録
            for( var i = 0; i < this.loadedImages.length; i++ ){
                //Image型オブジェクトからテクスチャを生成
                var texName = this.createTexture(this.gl, this.loadedImages[i]);

                this.live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
            }

            // テクスチャの元画像の参照をクリア
            this.loadedImages = null;

            // 表示位置を指定するための行列を定義する
            var s = this.modelscale / this.live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
            var matrix4x4 = [
                 s, 0, 0, 0,
                 0,-s, 0, 0,
                 0, 0, 1, 0,
                -this.modelscale/2, this.modelscale/2, 0, 1
            ];
            this.live2DModel.setMatrix(matrix4x4);
        }

        // アイドルモーション以外の場合（フラグと優先度で判定する）
        if(this.motionflg == true && this.motionMgr.getCurrentPriority() == 0){
            // フェードインの設定
            this.motions[this.motionnm].setFadeIn(this.fadeines[this.motionnm]);
            // フェードアウトの設定
            this.motions[this.motionnm].setFadeOut(this.fadeoutes[this.motionnm]);
            // アイドルモーションよりも優先度を高く再生する
            this.motionMgr.startMotion(this.motions[this.motionnm], 1);
            this.motionflg = false;
            // 音声ファイルもあれば再生
            if(this.sounds[this.motionnm]){
                // 前回の音声があれば停止する
                if(this.sounds[this.beforesound] != ""){
                    this.sounds[this.beforesound].stop();
                }
                // 音声を再生
                this.sounds[this.motionnm].play();
                // 途中で停止できるように格納する
                this.beforesound = this.motionnm;
            }
        }

        // モーションが終了していたらアイドルモーションの再生
        if(this.motionMgr.isFinished() && this.motionnm != null){
            // フェードインの設定
            this.motions[this.motionnm].setFadeIn(this.fadeines[this.motionnm]);
            // フェードアウトの設定
            this.motions[this.motionnm].setFadeOut(this.fadeoutes[this.motionnm]);
            // 優先度は低めでモーション再生
            this.motionMgr.startMotion(this.motions[this.motionnm], 0);
            // 音声ファイルもあれば再生
            if(this.sounds[this.motionnm]){
                // 前回の音声があれば停止する
                if(this.sounds[this.beforesound] != ""){
                    this.sounds[this.beforesound].stop();
                }
                // 音声を再生
                this.sounds[this.motionnm].play();
                // 途中で停止できるように格納する
                this.beforesound = this.motionnm;
            }
        }
        // モーション指定されていない場合は何も再生しない
        if(this.motionnm != null){
            // モーションパラメータの更新
            this.motionMgr.updateParam(this.live2DModel);
        }

        // 表情でパラメータ更新（相対変化）
        if(this.expressionManager != null &&
           this.expressions != null &&
           !this.expressionManager.isFinished())
        {
            this.expressionManager.updateParam(this.live2DModel);
        }
        // ポーズパラメータの更新
        if(this.pose != null)this.pose.updateParam(this.live2DModel);

        // 物理演算パラメータの更新
        if(this.physics != null)this.physics.updateParam(this.live2DModel);

        // ドラッグ用パラメータの更新
        this.dragMgr.update();
        this.dragX = this.dragMgr.getX();
        this.dragY = this.dragMgr.getY();
        this.live2DModel.setParamFloat("PARAM_ANGLE_X", this.dragX * 30);       // -30から30の値を加える
        this.live2DModel.setParamFloat("PARAM_ANGLE_Y", this.dragY * 30);
        // ドラッグによる体の向きの調整
        this.live2DModel.setParamFloat("PARAM_BODY_ANGLE_X", this.dragX*10);    // -10から10の値を加える
        // ドラッグによる目の向きの調整
        this.live2DModel.setParamFloat("PARAM_EYE_BALL_X", this.dragX);         // -1から1の値を加える
        this.live2DModel.setParamFloat("PARAM_EYE_BALL_Y", this.dragY);
        // キャラクターのパラメータを適当に更新
        var t = UtSystem.getTimeMSec() * 0.001 * 2 * Math.PI; //1秒ごとに2π(1周期)増える
        var cycle = 3.0; //パラメータが一周する時間(秒)
        // 呼吸する
        this.live2DModel.setParamFloat("PARAM_BREATH", 0.5 + 0.5 * Math.sin(t/cycle));

        // Live2Dモデルを更新して描画
        this.live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
        this.live2DModel.draw();    // 描画
    },

    /**
     * マウスイベント
     */
    mouseEvent : function(e)
    {
        // 右クリック制御
        e.preventDefault();
        // マウスダウン時
       if (e.type == "mousedown") {
           // 左クリック以外なら処理を抜ける
           if("button" in e && e.button != 0) return;
           this.modelTurnHead(e);

       // マウス移動時
       } else if (e.type == "mousemove") {
           this.followPointer(e);

       // マウスアップ時
       } else if (e.type == "mouseup") {
           // 左クリック以外なら処理を抜ける
           if("button" in e && e.button != 0) return;
           if (this.drag){
               this.drag = false;
           }
           this.dragMgr.setPoint(0, 0);

       // CANVAS外にマウスがいった時
       } else if (e.type == "mouseout") {
           if (this.drag)
           {
               this.drag = false;
           }
           this.dragMgr.setPoint(0, 0);
       }
    },

    /**
    * クリックされた方向を向く
    * タップされた場所に応じてモーションを再生
    */
    modelTurnHead : function(e)
    {
        this.drag = true;
        var rect = e.target.getBoundingClientRect();

        var sx = this.transformScreenX(e.clientX - rect.left);
        var sy = this.transformScreenY(e.clientY - rect.top);
        var vx = this.transformViewX(e.clientX - rect.left);
        var vy = this.transformViewY(e.clientY - rect.top);

        this.lastMouseX = sx;
        this.lastMouseY = sy;
        this.dragMgr.setPoint(vx, vy); // その方向を向く
    },

    /**
    * マウスを動かした時のイベント
    */
    followPointer : function(e)
    {
        var rect = e.target.getBoundingClientRect();
        var sx = this.transformScreenX(e.clientX - rect.left);
        var sy = this.transformScreenY(e.clientY - rect.top);
        var vx = this.transformViewX(e.clientX - rect.left);
        var vy = this.transformViewY(e.clientY - rect.top);

        if (this.drag)
        {
            this.lastMouseX = sx;
            this.lastMouseY = sy;
            this.dragMgr.setPoint(vx, vy); // その方向を向く
        }
    },

    /**
    * 論理座標変換したView座標X
    */
    transformViewX : function(deviceX)
    {
        var screenX = this.deviceToScreen.transformX(deviceX);  // 論理座標変換した座標を取得。
        return this.viewMatrix.invertTransformX(screenX);       // 拡大、縮小、移動後の値。
    },

    /**
    * 論理座標変換したView座標Y
    */
    transformViewY : function(deviceY)
    {
        var screenY = this.deviceToScreen.transformY(deviceY);  // 論理座標変換した座標を取得。
        return this.viewMatrix.invertTransformY(screenY);       // 拡大、縮小、移動後の値。
    },

    /**
    * 論理座標変換したScreen座標X
    */
    transformScreenX : function(deviceX)
    {
        return this.deviceToScreen.transformX(deviceX);
    },

    /**
    * 論理座標変換したScreen座標Y
    */
    transformScreenY : function(deviceY)
    {
        return this.deviceToScreen.transformY(deviceY);
    },

    /**
    * Image型オブジェクトからテクスチャを生成
    */
    createTexture : function(gl/*WebGLコンテキスト*/, image/*WebGL Image*/)
    {
        var texture = gl.createTexture(); //テクスチャオブジェクトを作成する
        if ( !texture ){
            console.log("Failed to generate gl texture name.");
            return -1;
        }

        if(this.live2DModel.isPremultipliedAlpha() == false) {
            // 乗算済アルファテクスチャ以外の場合
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
        // imageを上下反転
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        // テクスチャのユニットを指定する
        gl.activeTexture( gl.TEXTURE0 );
        // テクスチャをバインドする
        gl.bindTexture( gl.TEXTURE_2D , texture );
        // テクスチャに画像データを紐付ける
        gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , gl.RGBA , gl.UNSIGNED_BYTE , image);
        // テクスチャの品質を指定する(対象ピクセルの中心に最も近い点の値)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // ミップマップの品質を指定する
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        // ミップマップの生成
        gl.generateMipmap(gl.TEXTURE_2D);
        // テクスチャのバインド開放
        gl.bindTexture( gl.TEXTURE_2D , null );

        return texture;
    },

    /**
    * ファイルをバイト配列としてロードする
    */
    loadBytes : function(path , callback)
    {
        var request = new XMLHttpRequest();
        request.open("GET", path , true);
        request.responseType = "arraybuffer";
        request.onload = function(){
            switch( request.status ){
            case 200:
                callback( request.response );
                break;
            default:
                console.log( "Failed to load (" + request.status + ") : " + path );
                break;
            }
        }
        request.send(null);
    },

    /**
    * Jsonファイルをロードする
    */
    loadJson : function()
    {
        var thisRef = this;
        var request = new XMLHttpRequest();
        request.open("GET", this.filepath + this.filenm, true);
        request.onreadystatechange = function(){
            if(request.readyState == 4 && request.status == 200){
                // model.jsonから取得
                thisRef.modelDef = JSON.parse(request.responseText);
                // 初期化処理
                thisRef.initLoop();
            }
        }
        request.send(null);
    },

    /**
     * 表情をロードする
     */
    loadExpression : function(name, path){
        var thisRef = this;
        this.loadBytes(path, function(buf) {
            thisRef.expressionsnm[thisRef.expressionsnm.length] = name;
            thisRef.expressions[thisRef.expressions.length] = L2DExpressionMotion.loadJson(buf);
        });
    },

    /**
     * 表情を設定する
     */
    setExpression : function(name)
    {
        var cnt = 0;
        for(var i = 0; i < this.expressionsnm.length; i++){
            if(name == this.expressionsnm[i]){
                break;
            }
            cnt++;
        }
        var expression = this.expressions[cnt];
        this.expressionManager.startMotion(expression, false);
    },

    /**
     * ランダム表情設定する
     */
    setRandomExpression : function()
    {
        // ランダム再生する
        var random = ~~(Math.random() * this.expressions.length);
        var expression = this.expressions[random];
        this.expressionManager.startMotion(expression, false);
    },

    /**
     * モーションを設定する
     */
    setMotion : function(name)
    {
        if(this.modelDef == null)return;

        var cnt = 0;
        // ファイル名からファイル番号を取り出す
        for(var key in this.modelDef.motions){
            for(var j = 0; j < this.modelDef.motions[key].length; j++){
                // 余分なパスをカット
                var strfilenm = this.modelDef.motions[key][j].file.split("/");
                if(name == strfilenm[1]){
                    break;
                }
                cnt++;
            }
        }
        this.motionnm = cnt;
        this.motionflg = true;
    },

    /**
     * ランダムモーション再生する
     */
    setRandomMotion : function()
    {
        if(this.modelDef == null)return;
        // ランダム再生する
        this.motionnm = ~~(Math.random() * this.motions.length);
        this.motionflg = true;
    }
};

/****************************************
* サウンドクラス
****************************************/
var L2DSound = function(path /*音声ファイルパス*/) {
    this.snd = document.createElement("audio");
    this.snd.src = path;
};

L2DSound.prototype = {
    /**
    * 音声再生
    */
    play : function() {
        this.snd.play();
    },

    /**
    * 音声停止
    */
    stop : function() {
        this.snd.pause();
        this.snd.currentTime = 0;
    }
};
