var locationarray = [35,8.3,119, 121,8.3,6, 178,8.3,-101, 90,8.3,51, 
                     -50,8.3,62, -3,8.3,-10, 52,8.3,-93, 100,8.3,-168,
                     -143,8.3,14.5, -91,8.3,-70, -37,8.3,-152, 10,8.3,-225,
                     -231,8.3,-40, -176,8.3,-122, -122,8.3,-207, -76,8.3,-282,
                     -82,8.3,-183, -50,8.3,-246, -136,8.3,-96, 12,8.3,-130,
                     66,8.3,-31, -49,8.3,-36, -11,8.3,-103, -114,8.3,-29,
                     97,8.3,-64, 38,8.3,16, 72,8.3,-128, -148,8.3,-169];

function GetPosition(transform, connectionID)
{
    print("Getting position for Avatar " + connectionID);

    transform.pos.x = locationarray[0+3*(connectionID-1)];
    transform.pos.y = locationarray[1+3*(connectionID-1)];
    transform.pos.z = locationarray[2+3*(connectionID-1)];

    print("Setting position to X: " + transform.pos.x + " Y: " + transform.pos.y + " Z: " + transform.pos.z);

    return transform;
}
