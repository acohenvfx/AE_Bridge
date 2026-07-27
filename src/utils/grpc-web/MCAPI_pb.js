// source: MCAPI.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

var MCAPI_Types_pb = require('./MCAPI_Types_pb.js');
goog.object.extend(proto, MCAPI_Types_pb);
var google_protobuf_descriptor_pb = require('google-protobuf/google/protobuf/descriptor_pb.js');
goog.object.extend(proto, google_protobuf_descriptor_pb);
goog.exportSymbol('proto.mcapi.apiScope', null, global);

/**
 * A tuple of {field number, class constructor} for the extension
 * field named `apiScope`.
 * @type {!jspb.ExtensionFieldInfo<string>}
 */
proto.mcapi.apiScope = new jspb.ExtensionFieldInfo(
    10778,
    {apiScope: 0},
    null,
     /** @type {?function((boolean|undefined),!jspb.Message=): !Object} */ (
         null),
    0);

google_protobuf_descriptor_pb.MethodOptions.extensionsBinary[10778] = new jspb.ExtensionFieldBinaryInfo(
    proto.mcapi.apiScope,
    jspb.BinaryReader.prototype.readString,
    jspb.BinaryWriter.prototype.writeString,
    undefined,
    undefined,
    false);
// This registers the extension field with the extended class, so that
// toObject() will function correctly.
google_protobuf_descriptor_pb.MethodOptions.extensions[10778] = proto.mcapi.apiScope;

goog.object.extend(exports, proto.mcapi);
