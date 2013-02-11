// Portal script which enables possibility to make new connection attempts by clicking objects.
// Place this script to your entity which has placeable and visible mesh.
// Script now incorporates EC RenderToTexture behavior on the object to show remote world on portal texture.
// Jukka Vatjus-Anttila / CIE

//print("Portal.js: script initialized in " + me);

var isServer = server.IsRunning();
var firstRun = true;

if (!isServer)
{
    //to track display entity visibility to disable rtt tex update
    var rtt = null; //the current rtt target image used. what happens when it is removed? clean js execption?
    var rttBack = null;
    var conName = "";
    var freelookcameraPlaceable = null;
    var objectGrabbed = 0;

    var parentEntity = this.me;
    if (!parentEntity)
        return;

    input.TopLevelInputContext().MouseLeftPressed.connect(mouseLeftPress);
    input.TopLevelInputContext().MouseRightPressed.connect(mouseRightPress);
    
    input.TouchBegin.connect(OnTouchBegin);
    input.TouchUpdate.connect(OnTouchUpdate);
    input.TouchEnd.connect(OnTouchEnd);
    
    client.Disconnected.connect(clientDisconnected);
    // This happens every frame so be carefull... overwhelming dices!
    me.Action("Collision").Triggered.connect(handleCollision);
    me.Action("makeConnection").Triggered.connect(makeConnection);
    me.Action("update").Triggered.connect(updateView);
    me.Action("objectGrabbed").Triggered.connect(setObjectGrabStatus);

    if (firstRun)
    {
        firstRun = false;
        frame.DelayedExecute(1).Triggered.connect(initialize);
    }
    function OnTouchBegin()
    {
        print("DERP touch begin!");
    }

    function OnTouchUpdate()
    {
        print("DERP touch update!");
    }

    function OnTouchEnd()
    {
        print("DERP touch end!");
    }

    function setObjectGrabStatus(state)
    {
        objectGrabbed = state;
    }

    function initialize()
    {
        var camera_ent = scene.GetEntityByName("FreeLookCamera");
        if (camera_ent)
        {
            freelookcameraPlaceable = camera_ent.placeable;
            var cam = camera_ent.camera;
            if (cam)
            {
                cam.StartViewTracking(me);
                cam.EntityEnterView.connect(enterView);
                cam.EntityLeaveView.connect(leaveView);
                me.Exec(1, "update");
            }
        }
    }

    function mouseRightPress(event)
    {
        // Get entity from mouseclick location.
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
        if(raycastResult.entity != null)
        {
            // Check if clicked entity was parentEntity for this script
            if (parentEntity && raycastResult.entity == parentEntity)
            {
                if (conName != "")
                {
                    var otherScene = framework.Scene().GetScene(conName);
                    var portalCam = otherScene.EntityByName("PortalCamera");
                    print("Destroying " + portalCam.name + " which id is: " + portalCam.id);
                    otherScene.RemoveEntity(portalCam.id);
                    client.Logout(conName);
                }
            }
        }
    }

    function mouseLeftPress(event)
    {
        if (objectGrabbed == 1)
            return;
        // Get entity from mouseclick location.
        var raycastResult = scene.ogre.Raycast(event.x, event.y);
        if(raycastResult.entity != null)
        {
            // Check if clicked entity was parentEntity for this script
            if (parentEntity && raycastResult.entity == parentEntity)
            {
                // This should be changed according to the scene. If no avatar present then this is void.
                //var avatar = scene.GetEntityByName("Avatar" + client.GetConnectionID());
                var camera = scene.GetEntityByName("FreeLookCamera");
                if (camera)
                {
                    //frame.Updated.connect(this, moveCamera);

                    var cameraPos = camera.placeable.transform.pos;
                    var parentPos = parentEntity.placeable.transform.pos;
                    if (!cameraPos || !parentPos)
                        return;

                    // Lets check if controlled avatar is inside arbitary range to initialize login procedure.
                    var distance = cameraPos.Distance(parentPos);
                    if (distance  && distance < 30)
                    {

                        // This disconnect should be disabled if multiple simultaneous connections are wanted with multiconnection feature.a
                        //console.ExecuteCommand("Disconnect()");
                        client.Connected.connect(newConnection);
                        client.SwitchScene.connect(sceneSwitch);
                        //var ip = "130.231.12.112";
                        //var ip = "130.231.12.92";
                        var ip = "127.0.0.1";
                        switch (me.Name())
                        {
                            // These attributes are hardcoded for portalScene.
                        case "camdisplaywall1":
                            client.Login(ip, 2346,"Testaaja", "pass", "udp");
                            conName = ip + "-2346-udp";
                            break;
                        case "camdisplaywall2":
                            client.Login(ip, 2347,"Testaaja", "pass", "udp");
                            conName = ip + "-2347-udp";
                            break;
                        case "camdisplaywall3":
                            client.Login(ip, 2348,"Testaaja", "pass", "udp");
                            conName = ip + "-2348-udp";
                            break;
                        case "camdisplaywall4":
                            client.Login(ip, 2349,"Testaaja", "pass", "udp");
                            conName = ip + "-2349-udp";
                            break;

                        }
                    }
                }
                else
                {
                    print("No camera found or too far. No connection made from portal.\n");
                }
            }
        }
    }

    function makeConnection()
    {
        // This disconnect should be disabled if multiple simultaneous connections are wanted with multiconnection feature.a
        //console.ExecuteCommand("Disconnect()");
        client.Connected.connect(newConnection);
        client.SwitchScene.connect(sceneSwitch);
    }

    function handleCollision(entityID, sceneName, scale)
    {
        var ent = framework.Scene().GetScene(sceneName).EntityById(entityID);
        if (ent)
        {
            var otherScene = framework.Scene().GetScene(conName);
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

    function clientDisconnected(id)
    {
        if (id == conName)
        {
            // Set portal to black color when inactive.
            conName = "";
            rtt = null;
            me.mesh.SetMaterial(1, "portalMaterial.100.material");
            me.mesh.meshRef = me.mesh.meshRef;
        }
    }

    function sceneSwitch(name)
    {
        client.SwitchScene.disconnect(sceneSwitch);
        client.Connected.disconnect(newConnection);
    }

    function newConnection()
    {
        frame.DelayedExecute(3).Triggered.connect(this, init); //XXX dirty hack
        //wframe.Updated.connect(this, moveCamera);
    }

    function moveCamera()
    {
        // testcode
        var cameraEntity = scene.GetEntityByName("FreeLookCamera");
        var cameraTransform = cameraEntity.placeable.transform;
        var myTransform = me.placeable.transform;
        var moveVector = myTransform.pos.Sub(cameraTransform.pos);
        if (moveVector.LengthSq() < 4)
        {
            frame.Updated.disconnect(this, moveCamera);
            me.Exec(1, "makeConnection");
            return;
        }
        var suunta = moveVector.Normalized();

        cameraTransform.pos.x += suunta.x*0.5;
        cameraTransform.pos.y += suunta.y*0.5;
        cameraTransform.pos.z += suunta.z*0.5;

        cameraEntity.placeable.transform = cameraTransform;
    }

    function init()
    {
        var otherScene = framework.Scene().GetScene(conName);
        createCamera(otherScene);
        if (otherScene == null)
            return;
        // Get avatar camera if it exists in the scene.
        var cam = otherScene.GetEntityByName("AvatarCamera");
        if (cam)
        {
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "AvatarCamera_" + conName + "_tex";
        }
        else
        {
            // If there was no avatar camerạ, then get freelook.
            cam = otherScene.GetEntityByName("PortalCamera");
            if (cam == null)
                print("Got no camera for portal!");
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "PortalCamera_" + conName + "_tex";
        }
        // Render to texture resolution
        rtt.size_x = 400;
        rtt.size_y = 300;
        rtt.PrepareRtt();
        rtt.SetAutoUpdated(true);
        var matname = rtt.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
        me.mesh.SetMaterial(1, matname);
        client.SwitchScene.disconnect(sceneSwitch);
        client.Connected.disconnect(newConnection);

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
            rttBack = portalView.rtttarget;
            rttBack.textureName = "FreeLookCamera_portalBack_tex";
            rttBack.size_x = 400;
            rttBack.size_y = 300;
            rttBack.PrepareRtt();
            rttBack.SetAutoUpdated(true);
            var matnameBack = rttBack.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
            // Since 2.4.1 this does not set the material yet.
            // Need to reapply in switcher.js
            Entity.mesh.SetMaterial(1, matnameBack); 

        }
        cam.camera.SetActive();
    }

    function updateView()
    {
        var otherScene = null;
        switch (me.Name())
        {
            case "camdisplaywall1":
                conName = "130.231.12.112-2346-udp"
                otherScene = framework.Scene().GetScene(conName);
                break;
            case "camdisplaywall2":
                conName = "130.231.12.112-2347-udp"
                otherScene = framework.Scene().GetScene(conName);
                break;
            case "camdisplaywall3":
                conName = "130.231.12.112-2348-udp"
                otherScene = framework.Scene().GetScene(conName);
                break;
            case "camdisplaywall4":
                conName = "130.231.12.112-2349-udp"
                otherScene = framework.Scene().GetScene(conName);
                break;
        }
        if (otherScene == null)
            return;
        // Get avatar camera if it exists in the scene.
        var cam = otherScene.GetEntityByName("AvatarCamera");
        if (cam)
        {
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "AvatarCamera_" + conName + "_tex";
        }
        else
        {
            // If there was no avatar camerạ, then get freelook.
            cam = otherScene.GetEntityByName("PortalCamera");
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "PortalCamera_" + conName + "_tex";
        }
        // Render to texture resolution
        rtt.size_x = 400;
        rtt.size_y = 300;
        rtt.PrepareRtt();
        rtt.SetAutoUpdated(true);

        var matname = rtt.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
        me.mesh.SetMaterial(1, matname);
        scene.EntityByName("FreeLookCamera").camera.SetActive();
    }

    function enterView(entity)
    {
        if (rtt != null)
        {
            //print("Entity: " + entity.Name() + " has entered the view.");
            rtt.SetAutoUpdate(true);
        }
    }

    function leaveView(entity)
    {
        if (rtt != null)
        {
            //print("Entity: " + entity.Name() + " has left the view.");
            rtt.SetAutoUpdate(false);
        }
    }

    function createCamera(otherScene)
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
    function OnScriptDestroyed()
    {
        print("Doorportal script destroy!");
    }
}
