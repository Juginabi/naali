// Script that makes avatar run through checkpoints.

if (!server.IsRunning() && !framework.IsHeadless())
{
	engine.ImportExtension("qt.core");	// QTimer

	me.Action("startRunning").Triggered.connect(this, "initializeRunner");
}

function initializeRunner()
{
	avatar = scene.EntityByName("Avatar1");
	fish = scene.EntityByName("Fish");

	// Create a timer for placeable orientation calculations. Frame.updated 'slightly' too intense.
    timer = new QTimer();

    // Timeout in milliseconds.
    interval = 5000;

    // Start the timer and connect it to proper method.
    timer.start();
    timer.timeout.connect(run);
}

function run()
{
	// Avatarin paikka ja orientaatio maailmassa
	var avatarPaikka = this.avatar.placeable.WorldPosition();				// Float3
	var avatarOrientaatio = this.avatar.placeable.WorldOrientation();		// Quaternion
	
	// Avatarin rinnasta eteenpäin lähtevä suuntavektori normalisoituna
	var avatarSuunta = avatarOrientaatio.Mul(scene.ForwardVector());	// Float3
	
	// Esimerkkinä käytetyn kalan positio ja orientaatio maailmassa
	var fishPaikka = this.fish.placeable.WorldPosition();					// Float3
	var fishOrientaatio = this.fish.placeable.WorldOrientation();			// Quaternion

	// Suuntavektori avatarista kohteeseen (kala) normalisoituna
	var kohteenSuunta = fishPaikka.Sub(avatarPaikka).Normalized();		// float3

	// Avatarin rintamasuunnan ja kohteen suunnan vektoreiden kulma
	var kulmaRad = avatarSuunta.AngleBetweenNorm(kohteenSuunta);		// float3

	// Rotaatio quatti jotta saadaan avatar käännettyä tarvittava määrä radiaaneja.
	var rotQuat = Quat(float3(0,1,0), kulmaRad);

	// Kerrotaan avatarin orientaatio rotaatio quatilla. WRONG! *PUM*
	this.avatar.placeable.SetOrientation(avatarOrientaatio.Mul(rotQuat));

	print("Vektoreiden kulma: " + kulmaRad + "rad, rotQuat: " + rotQuat);
}

function magnitude(vector)
{
	var result = Math.sqrt(Math.pow(vector.x,2) + Math.pow(vector.y,2) + Math.pow(vector.z,2));
	return result;
}

/*float3x3 float3x3::LookAt(const float3 &localForward, const float3 &targetDirection, const float3 &localUp, const float3 &worldUp)
{
	// The user must have inputted proper normalized input direction vectors.
	assume(localForward.IsNormalized());
	assume(targetDirection.IsNormalized());
	assume(localUp.IsNormalized());
	assume(worldUp.IsNormalized());

	// In the local space, the forward and up directions must be perpendicular to be well-formed.
	assume(localForward.IsPerpendicular(localUp));

	// Generate the third basis vector in the local space.
	float3 localRight = localUp.Cross(localForward).Normalized();

	// A. Now we have an orthonormal linear basis { localRight, localUp, localForward } for the object local space.

	// Generate the third basis vector for the world space.
	float3 worldRight = worldUp.Cross(targetDirection).Normalized();
	// Since the input worldUp vector is not necessarily perpendicular to the targetDirection vector, 
	// we need to compute the real world space up vector that the "head" of the object will point 
	// towards when the model is looking towards the desired target direction.
	float3 perpWorldUp = targetDirection.Cross(worldRight).Normalized();
	
	// B. Now we have an orthonormal linear basis { worldRight, perpWorldUp, targetDirection } for the desired target orientation.

	// We want to build a matrix M that performs the following mapping:
	// 1. localRight must be mapped to worldRight.        (M * localRight = worldRight)
	// 2. localUp must be mapped to perpWorldUp.          (M * localUp = perpWorldUp)
	// 3. localForward must be mapped to targetDirection. (M * localForward = targetDirection)
	// i.e. we want to map the basis A to basis B.

	// This matrix M exists, and it is an orthonormal rotation matrix with a determinant of +1, because 
	// the bases A and B are orthonormal with the same handedness.

	// Below, use the notation that (a,b,c) is a 3x3 matrix with a as its first column, b second, and c third.
	
	// By algebraic manipulation, we can rewrite conditions 1, 2 and 3 in a matrix form:
	//        M * (localRight, localUp, localForward) = (worldRight, perpWorldUp, targetDirection)
	// or     M = (worldRight, perpWorldUp, targetDirection) * (localRight, localUp, localForward)^{-1}.
	// or     M = m1 * m2, where

	// m1 equals (worldRight, perpWorldUp, targetDirection):
	float3x3 m1(worldRight, perpWorldUp, targetDirection);

	// and m2 equals (localRight, localUp, localForward)^{-1}:
	float3x3 m2;
	m2.SetRow(0, localRight);
	m2.SetRow(1, localUp);
	m2.SetRow(2, localForward);
	// Above we used the shortcut that for an orthonormal matrix M, M^{-1} = M^T. So set the rows
	// and not the columns to directly produce the transpose, i.e. the inverse of (localRight, localUp, localForward).

	// Compute final M.
	m2 = m1 * m2;

	// And fix any numeric stability issues by re-orthonormalizing the result.
	m2.Orthonormalize(0, 1, 2);
	return m2;
}
*/