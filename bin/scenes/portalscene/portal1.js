// Copyright by Center for Internet Excellence, University of Oulu
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
    this.userName;

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

    this.userName = Math.random();
    
    this.me.Action("MouseRightPress").Triggered.connect(this, this.MouseRightPressed);
    this.me.Action("MouseLeftPress").Triggered.connect(this, this.MouseLeftPressed);
    this.me.Action("MouseLeftRelease").Triggered.connect(this, this.MouseLeftReleased);
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
        this.me.mesh.SetMaterial(1, "portalMaterial.100.material");
        this.me.mesh.meshRef = this.me.mesh.meshRef;
        return;
    }

    // Get avatar camera if it exists in the scene.
    var cam = otherScene.GetEntityByName("AvatarCamera");
    if (cam)
    {
        cam.GetOrCreateComponent("EC_RttTarget", 2, false);
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "AvatarCamera_" + this.conname + "_tex";
    }
    else
    {
        // If there was no avatar camerạ, then get freelook.
        cam = otherScene.GetEntityByName("PortalCamera-" + this.userName);
        if (cam == null)
            return;
        cam.GetOrCreateComponent("EC_RttTarget", 2, false);
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "PortalCamera-" + this.userName + "_" + this.conname + "_tex";
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
        this.me.Action("MouseLeftRelease").Triggered.disconnect(this, this.MouseLeftReleased);
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
    if (this.objectGrabbed == 1)
        return;

    var otherScene = framework.Scene().GetScene(this.conname);
    if (!otherScene)
        return;
    var portalCam = otherScene.EntityByName("PortalCamera-" + this.userName);
    // Set portal to black color when inactive.
    this.rtt = null;
    this.me.mesh.SetMaterial(1, "portalMaterial.100.material");
    this.me.mesh.meshRef = this.me.mesh.meshRef;
    print(otherScene.RemoveEntity(portalCam.id, 2));
    frame.DelayedExecute(0.2).Triggered.connect(this, this.logout);
}

Portal.prototype.logout = function()
{
    client.Logout(this.conname);
}

Portal.prototype.disconnection = function(scene)
{
    if (scene == this.conname)
    {
        this.connected = false;
        client.Disconnected.disconnect(this, this.disconnection);
    }
}

Portal.prototype.MouseLeftPressed = function(event)
{
    if (this.objectGrabbed == 1)
        return;
}

Portal.prototype.MouseLeftReleased = function(event)
{
    if (this.objectGrabbed == 1)
        return;
    // This disconnect should be disabled if multiple simultaneous connections are wanted with multiconnection feature.a
    //console.ExecuteCommand("Disconnect()");
    var ip = "130.231.12.54";
    //var ip = "130.231.12.92";
    //var ip = "127.0.0.1";
    switch (this.me.name)
    {
        // These attributes are hardcoded for portalScene.
    case "camdisplaywall1":
        if (!this.connected)
        {
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2346,"Testaaja", "pass", "udp");
            this.conname = ip + "-2346-udp";
        }
        else
        {
            client.SwitchScene.connect(this, this.switchscene);
            client.EmitSwitchScene(ip + "-2346-udp");
            //var camera = framework.Scene().GetScene(this.conname).EntityByName("PortalCamera-" + this.userName).camera;
            //print("Setting camera PortalCamera-" + this.userName + " active!");
            //camera.SetActive();
        }
        break;
    case "camdisplaywall2":
        if (!this.connected)
        {
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2347,"Testaaja", "pass", "udp");
            this.conname = ip + "-2347-udp";
        }
        else
        {
            client.SwitchScene.connect(this, this.switchscene);
            client.EmitSwitchScene(ip + "-2347-udp");
        }
        break;
    case "camdisplaywall3":
        if (!this.connected)
        {
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2348,"Testaaja", "pass", "udp");
            this.conname = ip + "-2348-udp";
        }
        else
        {
            client.SwitchScene.connect(this, this.switchscene);
            client.EmitSwitchScene(ip + "-2348-udp");
        }
        break;
    case "camdisplaywall4":
        if (!this.connected)
        {
            client.Connected.connect(this, this.newConnection);
            client.Login(ip, 2349,"Testaaja", "pass", "udp");
            this.conname = ip + "-2349-udp";
        }
        else
        {
            client.SwitchScene.connect(this, this.switchscene);
            client.EmitSwitchScene(ip + "-2349-udp");
        }
        break;
    }    
}

Portal.prototype.switchscene = function(name)
{
    print("At switchscene!");
    client.SwitchScene.disconnect(this, this.switchscene);
    print("Disconnected switch scene signal!");
    frame.DelayedExecute(0.1).Triggered.connect(this, this.DelayedSwitch);
}

Portal.prototype.DelayedSwitch = function(name)
{
    print("At delayed switch! " + this.userName);
    var camera = framework.Scene().GetScene(this.conname).EntityByName("PortalCamera-" + this.userName).camera;
    //print("Setting camera PortalCamera-" + this.userName + " active!");
    camera.SetActive();
}

Portal.prototype.newConnection = function(scenename)
{
    this.connected = true;
    frame.DelayedExecute(3).Triggered.connect(this, this.init); //XXX dirty hack
}

Portal.prototype.init = function()
{
    this.connected = true;

    var otherScene = framework.Scene().GetScene(this.conname);
    if (otherScene == null)
        return;
    this.createCamera(otherScene);
    // Get avatar camera if it exists in the scene.
    var cam = otherScene.GetEntityByName("AvatarCamera");
    if (cam)
    {
        cam.GetOrCreateComponent("EC_RttTarget", 2, false);
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "AvatarCamera_" + this.conname + "_tex";
    }
    else
    {
        // If there was no avatar camerạ, then get freelook.
        cam = otherScene.GetEntityByName("PortalCamera-" + this.userName);
        if (cam == null)
        {
            print("Got no camera for portal!");
            return;
        }
        else
            print("Got portal camera!");
        cam.GetOrCreateComponent("EC_RttTarget", 2, false);
        this.rtt = cam.rtttarget;
        this.rtt.textureName = "PortalCamera-" + this.userName + "_" + this.conname + "_tex";
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

    var Entity = otherScene.EntityByName("camdisplaywall");
    if (!Entity)
    {
        Entity = otherScene.CreateEntity(otherScene.NextFreeIdLocal(), ["EC_Mesh", "EC_Name", "EC_Script", "EC_Placeable"], 2, false, false);
        //Entity = otherScene.CreateEntity(scene.NextFreeId(), ["EC_Mesh", "EC_Name", "EC_Script", "EC_Placeable"]);
        Entity.name = this.userName;
        var script = Entity.script;
        script.scriptRef = new AssetReference("local://switcherNew.js");
        script.runOnLoad = true;
        script.applicationName = "PortalApp";
        script.className = "PortalApp.Switcher";
        //Entity.script.runOnLoad = true;
        Entity.mesh.meshRef = "portalCylinder.mesh";
        var cameraEnt = otherScene.EntityByName("PortalCamera-" + this.userName);
        var placeable = Entity.placeable;

        placeable.SetParent(cameraEnt,0);
        placeable.SetPosition(-1.27,-0.6,-2.3);
        placeable.SetScale(0.3,0.05,0.3);
        var old = placeable.transform;
        old.rot = new float3(-105,29,3);
        placeable.transform = old;
        var portalView = scene.GetEntityByName("FreeLookCamera");
        portalView.GetOrCreateComponent("EC_RttTarget", 2, false);
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
        Entity.Exec(1, "setName", this.userName);
    }
    print("Setting camera active in Init!");
    cam.camera.SetActive();
}

Portal.prototype.createCamera = function(otherScene)
{
    var Entity = otherScene.EntityByName("PortalCamera-" + this.userName);
    if (Entity)
        return;

    Entity = otherScene.CreateEntity(otherScene.NextFreeId());

    Entity.GetOrCreateComponent("EC_Name", 2, false);
    Entity.GetOrCreateComponent("EC_Camera", 2, false);
    Entity.GetOrCreateComponent("EC_Script", 2, false);
    Entity.GetOrCreateComponent("EC_Placeable", 2, false);
    Entity.name = "PortalCamera-" + this.userName;
    
    var freelook = otherScene.GetEntityByName("FreeLookCamera");
    var freelookTransform = freelook.placeable.transform;
    var portalCamTransform = Entity.placeable.transform;
    portalCamTransform.pos = freelookTransform.pos;
    portalCamTransform.rot = freelookTransform.rot;
    Entity.placeable.transform = portalCamTransform;

    Entity.script.scriptRef = new AssetReference("freelookcamera.js");
    // Run only on client
    Entity.script.runMode = 1;
    Entity.script.runOnLoad = true;
    
    var grabApp = scene.EntityByName("ObjectGrabApp");
    grabApp.Exec(1, "NewTargetScene", otherScene.name, Entity.name);
}

Portal.prototype.handleCollision = function(entityID, sceneName, scale)
{
    var ent = framework.Scene().GetScene(sceneName).EntityById(entityID);
    if (ent)
    {
        var otherScene = framework.Scene().GetScene(this.conname);
        if (otherScene)
        {
            var camera = null;
            if (!(camera = otherScene.GetEntityByName("AvatarCamera")))
            {
                if (!(camera = otherScene.GetEntityByName("PortalCamera-" + this.userName)))
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
                Entity.placeable.transform = oldTransform;
                //Entity.placeable.SetPosition(oldTransform.pos);

                // Set same mesh attributes to a new entity as in the entity dragged to portal
                Entity.mesh.SetAdjustScale(ent.mesh.GetAdjustScale());
                Entity.mesh.SetAdjustPosition(ent.mesh.GetAdjustPosition());
                Entity.mesh.SetAdjustOrientation(ent.mesh.GetAdjustOrientation());
                Entity.mesh.meshRef = ent.mesh.meshRef;
                Entity.mesh.meshMaterial = ent.mesh.meshMaterial;

                // Set same name also
                Entity.name = ent.name;

                // Set rigidbody size and mass.
                var size = ent.rigidbody.size;
                Entity.rigidbody.mass = 10;
                Entity.rigidbody.size = size;
                Entity.rigidbody.shapeType = ent.rigidbody.shapeType;
                framework.Scene().GetScene(sceneName).RemoveEntity(entityID);
            }
        }
    }
}

Portal.prototype.setObjectGrabStatus = function(state)
{
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