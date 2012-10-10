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
    var conName = "";

    var parentEntity = this.me;
    if (!parentEntity)
        return;

    input.TopLevelInputContext().MouseLeftPressed.connect(mouseLeftPress);
    input.TopLevelInputContext().MouseRightPressed.connect(mouseRightPress);
    client.Disconnected.connect(clientDisconnected);
    // This happens every frame so be carefull... overwhelming dices!
    me.Action("Collision").Triggered.connect(handleCollision);


    if (firstRun)
    {
        firstRun = false;
        frame.DelayedExecute(1).Triggered.connect(initialize);
    }

    function initialize()
    {
        var camera_ent = scene.GetEntityByName("FreeLookCamera");
        if (camera_ent)
        {
            var cam = camera_ent.camera;
            if (cam)
            {
                cam.StartViewTracking(me);
                cam.EntityEnterView.connect(enterView);
                cam.EntityLeaveView.connect(leaveView);
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
                    client.Logout(conName);
                }
            }
        }
    }

    function mouseLeftPress(event)
    {
        // Get entity from mouseclick location.
        var raycastResult = scene.ogre.Raycast(event.x, event.y, 0xffffffff);
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

                    var cameraPos = camera.placeable.transform.pos;
                    var parentPos = parentEntity.placeable.transform.pos;
                    if (!cameraPos || !parentPos)
                        return;

                    // Lets check if controlled avatar is inside arbitary range to initialize login procedure.
                    var distance = cameraPos.Distance(parentPos);
                    if (distance  && distance < 20)
                    {

                        // This disconnect should be disabled if multiple simultaneous connections are wanted with multiconnection feature.a
                        //console.ExecuteCommand("Disconnect()");
                        client.Connected.connect(newConnection);
                        client.switchScene.connect(sceneSwitch);
                        switch (me.Name())
                        {
                            // These attributes are hardcoded for portalScene.
                        case "camdisplaywall1":
                            client.Login("localhost", 2346,"lal", "pass", "udp");
                            conName = "127.0.0.1-2346-udp";
                            break;
                        case "camdisplaywall2":
                            client.Login("localhost", 2347,"lal", "pass", "udp");
                            conName = "127.0.0.1-2347-udp";
                            break;
                        case "camdisplaywall3":
                            client.Login("localhost", 2348,"lal", "pass", "udp");
                            conName = "127.0.0.1-2348-udp";
                            break;
                        case "camdisplaywall4":
                            client.Login("localhost", 2349,"lal", "pass", "udp");
                            conName = "127.0.0.1-2349-udp";
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
                    if (!(camera = otherScene.GetEntityByName("FreeLookCamera")))
                    {
                        print("No camera found from target scene. Unable to copy entity.")
                        return;
                    }
                }

                // Calculate position in front of the active scene camera.
                var camerapos = camera.placeable.WorldPosition();
                var worldOrient = camera.placeable.WorldOrientation();
                var suunta = worldOrient.Mul(otherScene.ForwardVector());
                var uusSuunta = suunta.Mul(new float3(8, 8, 8));
                var uusPaikka = uusSuunta.Add(camerapos);

                // Create new entity to target scene.
                var Entity = otherScene.CreateEntity(scene.NextFreeId(), ["EC_Placeable", "EC_Mesh", "EC_Name", "EC_Rigidbody", "EC_Sound"]);
                if (Entity)
                {
                    // Set placeable parameters. Random position.
                    var oldTransform = Entity.placeable.transform;
                    oldTransform.pos = uusPaikka;
                    oldTransform.scale.x = scale;
                    oldTransform.scale.y = scale;
                    oldTransform.scale.z = scale;
                    Entity.placeable.transform = oldTransform;

                    // Set same material to new entity as in the entity dragged to portal
                    Entity.mesh.meshRef = ent.mesh.meshRef;
                    Entity.mesh.meshMaterial = ent.mesh.meshMaterial;

                    // Set same name also
                    Entity.name = ent.name;
                    // Set rigidbody size and mass.
                    var size = new float3(2,2,2);
                    Entity.rigidbody.mass = 10;
                    Entity.rigidbody.size = size;

//                    // Add pop sound
//                    Entity.sound.soundRef = "http://chiru.cie.fi/PortalScene2/POP.WAV";
//                    Entity.sound.soundOuterRadius = 1000;

//                     This is just for funzies.
//                                    var script = Entity.GetOrCreateComponent("EC_Script");
//                                    script.scriptRef = new AssetReference("http://chiru.cie.fi/PortalScene2/duplicate.js");
//                                    script.runOnLoad = true;
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
        client.switchScene.disconnect(sceneSwitch);
        client.Connected.disconnect(newConnection);
    }

    function newConnection()
    {
        frame.DelayedExecute(1).Triggered.connect(this, init); //XXX dirty hack
    }

    function init()
    {
        var otherScene = framework.Scene().GetScene(conName);
        if (otherScene == null)
            return;
        // Get avatar camera if it exists in the scene.
        var cam = otherScene.GetEntityByName("AvatarCamera");
        if (cam)
        {
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "AvatarCamera_" + conName + "_tex";
            print("RTT: " + rtt.textureName);
        }
        else
        {
            // If there was no avatar camerạ, then get freelook.
            cam = otherScene.GetEntityByName("FreeLookCamera");
            cam.GetOrCreateComponent("EC_RttTarget");
            rtt = cam.rtttarget;
            rtt.textureName = "FreeLookCamera_" + conName + "_tex";
        }
        // Render to texture resolution
        rtt.size_x = 400;
        rtt.size_y = 300;
        rtt.PrepareRtt();
        rtt.SetAutoUpdated(true);
        var matname = rtt.textureName + "_mat"; //XXX add mat name getter to EC_RttTarget
        me.mesh.SetMaterial(1, matname);
        client.switchScene.disconnect(sceneSwitch);
        client.Connected.disconnect(newConnection);
        client.emitSceneSwitch(scene.name);
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
}
