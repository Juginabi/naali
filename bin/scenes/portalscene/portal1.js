
function Portal(entity, comp)
{
    this.isServer = server.IsRunning();
    this.me = entity;
    this.rtt = null; //the current rtt target image used. what happens when it is removed? clean js execption?
    this.rttBack = null;
    this.cam = null;
    this.conname;
    this.connected = false;
    this.objectGrabbed = 0;

    if (this.isServer)
    {
        this.ServerInit();
    }
    else
    {
        this.ClientInit();
    }
}

Portal.prototype.ServerInit = function()
{
    print("[Portal application] Server initialize " + this.me.name);
    frame.Updated.connect(this, this.ServerUpdate);
}

Portal.prototype.ServerUpdate = function(frametime)
{

}

Portal.prototype.ClientInit = function()
{
    print("[Portal application] Client initialize " + this.me.name);

    var camera_ent = scene.GetEntityByName("FreeLookCamera");
    if (camera_ent)
    {
        freelookcameraPlaceable = camera_ent.placeable;
        var cam = camera_ent.camera;
        if (cam)
        {
            this.cam = cam;
            this.cam.StartViewTracking(this.me);
            this.cam.EntityEnterView.connect(this, this.enterView);
            this.cam.EntityLeaveView.connect(this, this.leaveView);
        }
    }
    
    this.me.Action("MouseRightPress").Triggered.connect(this, this.MouseRightPressed);
    this.me.Action("MouseLeftPress").Triggered.connect(this, this.MouseLeftPressed);
    this.me.Action("Collision").Triggered.connect(this, this.handleCollision);
    //me.Action("makeConnection").Triggered.connect(this, this.makeConnection);
    //me.Action("update").Triggered.connect(this, this.ClientUpdateView);
    
    // Entity action handlers
    this.me.Action("objectGrabbed").Triggered.connect(this, this.setObjectGrabStatus);
    //frame.Updated.connect(this, this.ClientUpdateView);
}

Portal.prototype.ClientUpdateView = function(frametime)
{
    var otherScene = null;
    switch (this.me.name)
    {
        case "camdisplaywall1":
            this.conname = "127.0.0.1-2346-udp"
            otherScene = framework.Scene().GetScene(this.conname);
            break;
        case "camdisplaywall2":
            this.conname = "127.0.0.1-2347-udp"
            otherScene = framework.Scene().GetScene(this.conname);
            break;
        case "camdisplaywall3":
            this.conname = "127.0.0.1-2348-udp"
            otherScene = framework.Scene().GetScene(this.conname);
            break;
        case "camdisplaywall4":
            this.conname = "127.0.0.1-2349-udp"
            otherScene = framework.Scene().GetScene(this.conname);
            break;
    }
    if (otherScene == null)
    {
        print(this.me.name + " setting material to 100!");
        this.me.mesh.SetMaterial(1, "portalMaterial.100.material");
        this.me.mesh.meshRef = this.me.mesh.meshRef;
        return;
    }

    // Get avatar camera if it exists in the scene.
    var cam = otherScene.GetEntityByName("AvatarCamera");
    if (cam)
    {
        cam.GetOrCreateComponent("EC_RttTarget");
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "AvatarCamera_" + this.conname + "_tex";
    }
    else
    {
        // If there was no avatar camerạ, then get freelook.
        cam = otherScene.GetEntityByName("PortalCamera");
        if (cam == null)
            return;
        cam.GetOrCreateComponent("EC_RttTarget");
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "PortalCamera_" + this.conname + "_tex";
    }
    // Render to texture resolution
    this.rtt.size_x = 400;
    this.rtt.size_y = 300;
    this.rtt.PrepareRtt();
    this.rtt.SetAutoUpdated(true);

    var matname = this.rtt.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
    this.me.mesh.SetMaterial(1, matname);
    scene.EntityByName("FreeLookCamera").camera.SetActive();
}

Portal.prototype.OnScriptObjectDestroyed = function()
{
    if (!this.isServer)
    {
        frame.Updated.disconnect(this, this.ClientUpdateView);
        if (this.cam)
        {
            this.cam.EntityEnterView.disconnect(this, this.enterView);
            this.cam.EntityLeaveView.disconnect(this, this.leaveView);
        }
        this.me.Action("MouseRightPress").Triggered.disconnect(this, this.MouseRightPressed);
        this.me.Action("MouseLeftPress").Triggered.disconnect(this, this.MouseLeftPressed);
        // Entity actions
        this.me.Action("objectGrabbed").Triggered.disconnect(this, this.setObjectGrabStatus);
    }
    else
    {
        frame.Updated.disconnect(this, this.ServerUpdate);
    }
}

Portal.prototype.enterView = function()
{
    if (this.rtt != null)
    {
        //print("Entity: " + entity.Name() + " has entered the view.");
        this.rtt.SetAutoUpdate(true);
    }
}

Portal.prototype.leaveView = function()
{
    if (this.rtt != null)
    {
        //print("Entity: " + entity.Name() + " has left the view.");
        this.rtt.SetAutoUpdate(false);
    }
}

Portal.prototype.MouseRightPressed = function(event)
{
    print("[Portal application] Mouse right pressed in " + this.me.name);

    if (this.objectGrabbed == 1)
        return;

    var otherScene = framework.Scene().GetScene(this.conname);
    if (!otherScene)
        return;
    var portalCam = otherScene.EntityByName("PortalCamera");
    // Set portal to black color when inactive.
    this.rtt = null;
    this.me.mesh.SetMaterial(1, "portalMaterial.100.material");
    this.me.mesh.meshRef = this.me.mesh.meshRef;
    print("Destroying " + portalCam.name + " which id is: " + portalCam.id);
    otherScene.RemoveEntity(portalCam.id);
    client.Logout(this.conname);
}

Portal.prototype.disconnection = function(scene)
{
    if (scene == this.conname)
    {
        print("Disconnection from " + scene);
        this.connected = false;
        client.Disconnected.disconnect(this, this.disconnection);
    }
}

Portal.prototype.MouseLeftPressed = function(event)
{
    print("[Portal application] Mouse left pressed in " + this.me.name);

    if (this.objectGrabbed == 1)
        return;

    // This disconnect should be disabled if multiple simultaneous connections are wanted with multiconnection feature.a
    //console.ExecuteCommand("Disconnect()");
    //var ip = "130.231.12.112";
    //var ip = "130.231.12.92";
    var ip = "127.0.0.1";
    switch (this.me.name)
    {
        // These attributes are hardcoded for portalScene.
    case "camdisplaywall1":
        if (!this.connected)
        {
            this.connected = true;
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2346,"Testaaja", "pass", "udp");
            this.conname = ip + "-2346-udp";
        }
        else
            client.EmitSwitchScene(ip + "-2346-udp");
        break;
    case "camdisplaywall2":
        if (!this.connected)
        {
            this.connected = true;
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2347,"Testaaja", "pass", "udp");
            this.conname = ip + "-2347-udp";
        }
        else
            client.EmitSwitchScene(ip + "-2347-udp");
        break;
    case "camdisplaywall3":
        if (!this.connected)
        {
            this.connected = true;
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2348,"Testaaja", "pass", "udp");
            this.conname = ip + "-2348-udp";
        }
        else
            client.EmitSwitchScene(ip + "-2348-udp");
        break;
    case "camdisplaywall4":
        if (!this.connected)
        {
            this.connected = true;
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2349,"Testaaja", "pass", "udp");
            this.conname = ip + "-2349-udp";
        }
        else
            client.EmitSwitchScene(ip + "-2349-udp");
        break;
    }
}

Portal.prototype.newConnection = function(scenename)
{
    print("[Portal application] executing init in 3 seconds...");
    frame.DelayedExecute(3).Triggered.connect(this, this.init); //XXX dirty hack
}

Portal.prototype.init = function()
{
    print("[Portal application] Connection init " + this.me.name);

    this.connected = true;

    var otherScene = framework.Scene().GetScene(this.conname);
    if (otherScene == null)
        return;
    this.createCamera(otherScene);
    // Get avatar camera if it exists in the scene.
    var cam = otherScene.GetEntityByName("AvatarCamera");
    if (cam)
    {
        cam.GetOrCreateComponent("EC_RttTarget");
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "AvatarCamera_" + this.conname + "_tex";
    }
    else
    {
        // If there was no avatar camerạ, then get freelook.
        cam = otherScene.GetEntityByName("PortalCamera");
        if (cam == null)
        {
            print("Got no camera for portal!");
            return;
        }
        else
            print("Got portal camera!");
        cam.GetOrCreateComponent("EC_RttTarget");
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "PortalCamera_" + this.conname + "_tex";
    }
    // Render to texture resolution
    this.rtt.size_x = 400;
    this.rtt.size_y = 300;
    this.rtt.PrepareRtt();
    this.rtt.SetAutoUpdated(true);
    var matname = this.rtt.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
    this.me.mesh.SetMaterial(1, matname);
    client.Connected.disconnect(this, this.newConnection);
    client.Disconnected.connect(this, this.disconnection);

    var Entity = otherScene.EntityByName("3D-UI-switch");
    if (!Entity)
    {
        print("No 3d UI switch!");
        Entity = otherScene.CreateEntity(otherScene.NextFreeIdLocal(), ["EC_Mesh", "EC_Name", "EC_Script", "EC_Placeable"], 2, false, false);
        //Entity = otherScene.CreateEntity(scene.NextFreeId(), ["EC_Mesh", "EC_Name", "EC_Script", "EC_Placeable"]);
        Entity.name = "3D-UI-switch";
        Entity.script.scriptRef = new AssetReference("local://switcher.js");
        Entity.script.runOnLoad = true;
        Entity.mesh.meshRef = "portalCylinder.mesh";
        var cameraEnt = otherScene.EntityByName("PortalCamera");
        var placeable = Entity.placeable;

        placeable.SetParent(cameraEnt,0);
        placeable.SetPosition(-1.27,-0.6,-2.3);
        placeable.SetScale(0.3,0.05,0.3);
        var old = placeable.transform;
        old.rot = new float3(-105,29,3);
        placeable.transform = old;
        var portalView = scene.GetEntityByName("FreeLookCamera");
        portalView.GetOrCreateComponent("EC_RttTarget");
        this.rttBack = portalView.rtttarget;
        this.rttBack.textureName = "FreeLookCamera_portalBack_tex";
        this.rttBack.size_x = 400;
        this.rttBack.size_y = 300;
        this.rttBack.PrepareRtt();
        this.rttBack.SetAutoUpdated(true);
        var matnameBack = this.rttBack.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
        // Since 2.4.1 this does not set the material yet.
        // Need to reapply in switcher.js
        Entity.mesh.SetMaterial(1, matnameBack); 

    }
    cam.camera.SetActive();
}

Portal.prototype.createCamera = function(otherScene)
{
    var Entity = otherScene.EntityByName("PortalCamera");
    if (Entity)
        return;

    Entity = otherScene.CreateEntity(otherScene.NextFreeId(), ["EC_Name", "EC_Placeable", "EC_Camera", "EC_Script"]);

    Entity.name = "PortalCamera";
    var freelook = otherScene.GetEntityByName("FreeLookCamera");
    var freelookTransform = freelook.placeable.transform;
    var portalCamTransform = Entity.placeable.transform;
    portalCamTransform.pos = freelookTransform.pos;
    portalCamTransform.rot = freelookTransform.rot;
    Entity.placeable.transform = portalCamTransform;

    Entity.script.scriptRef = new AssetReference("freelookcamera.js");
    Entity.script.runOnLoad = true;
}

Portal.prototype.handleCollision = function(entityID, sceneName, scale)
{
    print("scene: " + sceneName + ", entity: " + framework.Scene().GetScene(sceneName).EntityById(entityID).name + ", conName: " + this.conname); 
    var ent = framework.Scene().GetScene(sceneName).EntityById(entityID);
    if (ent)
    {
        var otherScene = framework.Scene().GetScene(this.conname);
        if (otherScene)
        {
            var camera = null;
            if (!(camera = otherScene.GetEntityByName("AvatarCamera")))
            {
                if (!(camera = otherScene.GetEntityByName("PortalCamera")))
                {
                    print("No camera found from target scene. Unable to copy entity.")
                    return;
                }
            }

            // Calculate position in front of the active scene camera.
            var camerapos = camera.placeable.WorldPosition();
            var worldOrient = camera.placeable.Orientation();
            var suunta = worldOrient.Mul(otherScene.ForwardVector());
            var uusSuunta = suunta.Mul(6);
            var uusPaikka = uusSuunta.Add(camerapos);
            uusPaikka.y += Math.random()*3;

            // Create new entity to target scene.
            var Entity = otherScene.CreateEntity(scene.NextFreeId(), ["EC_Placeable", "EC_Mesh", "EC_Name", "EC_Rigidbody"]);
            if (Entity)
            {
                // Set placeable parameters. Random position.
                var oldTransform = Entity.placeable.transform;
                oldTransform.pos = uusPaikka;
                oldTransform.scale = ent.placeable.transform.scale;
                //Entity.placeable.transform = oldTransform;
                Entity.placeable.SetPosition(oldTransform.pos);

                // Set same mesh attributes to a new entity as in the entity dragged to portal
                Entity.mesh.SetAdjustScale(ent.mesh.GetAdjustScale().Mul(float3(0.5,0.5,0.5)));
                Entity.mesh.SetAdjustPosition(ent.mesh.GetAdjustPosition().Mul(float3(0.5,0.5,0.5)));
                Entity.mesh.SetAdjustOrientation(ent.mesh.GetAdjustOrientation());
                Entity.mesh.meshRef = ent.mesh.meshRef;
                Entity.mesh.meshMaterial = ent.mesh.meshMaterial;

                // Set same name also
                Entity.name = ent.name;

                // Set rigidbody size and mass.
                var size = ent.rigidbody.size;
                Entity.rigidbody.mass = 10;
                Entity.rigidbody.size = size.Mul(float3(0.5,0.5,0.5));
                Entity.rigidbody.shapeType = ent.rigidbody.shapeType;
            }
        }
    }
}

Portal.prototype.setObjectGrabStatus = function(state)
{
    print("[Portal application] Set object grab status: " + state);
    this.objectGrabbed = state;
}


// function OnScriptDestroyed()
// {
//     print("Doorportal script destroy!");
//     if (this.isServer)
//     {
//         frame.Updated.disconnect(this, this.ServerUpdate);
//     }
//     else
//     {

//     }
// }