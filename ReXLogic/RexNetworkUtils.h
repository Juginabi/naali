// For conditions of distribution and use, see copyright notice in license.txt

#ifndef incl_RexNetworkUtils_h
#define incl_RexNetworkUtils_h

#include "RexTypes.h"
#include "RexUUID.h"

namespace RexLogic
{       
    //! Creates an OBB for debug visualization of the extents of the given scene object.
    void DebugCreateOgreBoundingBox(Foundation::ModuleInterface *module, const Foundation::ComponentInterfacePtr ogrePlaceable, const std::string &materialName);
    
    //! Helper functions for getting values from terseupdate packets
    Core::Quaternion GetProcessedQuaternion(const uint8_t* bytes);
    Core::Vector3df GetProcessedScaledVectorFromUint16(const uint8_t* bytes, float scale);
    Core::Vector3df GetProcessedVectorFromUint16(const uint8_t* bytes);
    Core::Vector3df GetProcessedVector(const uint8_t* bytes);
    
    bool ParseBool(const std::string &value);
    
    //! Helper functions for reading values from byteblob
    bool ReadBoolFromBytes(const uint8_t* bytes, int& idx);
    uint8_t ReadUInt8FromBytes(const uint8_t* bytes, int& idx);
    uint32_t ReadUInt32FromBytes(const uint8_t* bytes, int& idx);
    float ReadFloatFromBytes(const uint8_t* bytes, int& idx);
    RexTypes::RexUUID ReadUUIDFromBytes(const uint8_t* bytes, int& idx);
    std::string ReadNullTerminatedStringFromBytes(const uint8_t* bytes, int& idx);
}

#endif