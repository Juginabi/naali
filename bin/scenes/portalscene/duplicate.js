// Funny entity duplication script. Can easily crash either client or server or both eventually.
var isServer = server.IsRunning();
var firstRun = true;

if (!isServer)
{
    frame.DelayedExecute((Math.random()*15)+5).Triggered.connect(this, duplicate);
    me.sound.soundRef = "http://chiru.cie.fi/PortalScene2/POP.WAV";
    me.Exec(1, "PlaySound");
}

function duplicate()
{
    var rand = Math.random();
    // Create new entity to target scene.
    var Entity = scene.CreateEntity(scene.NextFreeId(), ["EC_Placeable", "EC_Mesh", "EC_Name", "EC_Rigidbody", "EC_Script", "EC_Sound"]);
    // Set placeable parameters. Random position.
    var oldTransform = Entity.placeable.transform;
    oldTransform.pos = me.placeable.transform.pos;
    if (rand < 0.5)
    {
        oldTransform.pos.x -= 0.75;
        oldTransform.pos.y += 0.75;
    }
    else
    {
        oldTransform.pos.x += 0.75;
        oldTransform.pos.y += 0.75;
    }
    Entity.placeable.transform = oldTransform;
    // Set same material to new entity as in the entity dragged to portal
    Entity.mesh.meshRef = me.mesh.meshRef;
    Entity.mesh.meshMaterial = me.mesh.meshMaterial;
    // Set same name also
    Entity.name = me.name;
    // Set rigidbody size and mass.
    var size = new float3(2,2,2);
    Entity.rigidbody.mass = 10;
    Entity.rigidbody.size = size;
    var kopioituKuutio = Entity.script.scriptRef;
    kopioituKuutio = me.script.scriptRef;
    Entity.script.scriptRef = kopioituKuutio;
    Entity.script.runOnLoad = true;
    Entity.sound.soundOuterRadius = 1000;

    frame.DelayedExecute((Math.random()*15)+5).Triggered.connect(this, duplicate);
}
