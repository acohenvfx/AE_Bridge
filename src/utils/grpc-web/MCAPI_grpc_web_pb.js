/**
 * @fileoverview gRPC-Web generated client stub for mcapi
 * @enhanceable
 * @public
 */

// GENERATED CODE -- DO NOT EDIT!

/* eslint-disable */
// @ts-nocheck



const grpc = {};
grpc.web = require('grpc-web');


var MCAPI_Types_pb = require('./MCAPI_Types_pb.js')

var google_protobuf_descriptor_pb = require('google-protobuf/google/protobuf/descriptor_pb.js')
const proto = {};
proto.mcapi = require('./MCAPI_pb.js');

/**
 * @param {string} hostname
 * @param {?Object} credentials
 * @param {?grpc.web.ClientOptions} options
 * @constructor
 * @struct
 * @final
 */
proto.mcapi.MCAPIClient =
    function(hostname, credentials, options) {
  if (!options) options = {};
  options.format = 'text';

  /**
   * @private @const {!grpc.web.GrpcWebClientBase} The client
   */
  this.client_ = new grpc.web.GrpcWebClientBase(options);

  /**
   * @private @const {string} The hostname
   */
  this.hostname_ = hostname;

};


/**
 * @param {string} hostname
 * @param {?Object} credentials
 * @param {?grpc.web.ClientOptions} options
 * @constructor
 * @struct
 * @final
 */
proto.mcapi.MCAPIPromiseClient =
    function(hostname, credentials, options) {
  if (!options) options = {};
  options.format = 'text';

  /**
   * @private @const {!grpc.web.GrpcWebClientBase} The client
   */
  this.client_ = new grpc.web.GrpcWebClientBase(options);

  /**
   * @private @const {string} The hostname
   */
  this.hostname_ = hostname;

};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.EchoRequest,
 *   !proto.mcapi.EchoResponse>}
 */
const methodDescriptor_MCAPI_Echo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/Echo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.EchoRequest,
  MCAPI_Types_pb.EchoResponse,
  /**
   * @param {!proto.mcapi.EchoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.EchoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.EchoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.EchoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.EchoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.echo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/Echo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_Echo,
      callback);
};


/**
 * @param {!proto.mcapi.EchoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.EchoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.echo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/Echo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_Echo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetValuesRequest,
 *   !proto.mcapi.GetValuesResponse>}
 */
const methodDescriptor_MCAPI_GetValues = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetValues',
  grpc.web.MethodType.SERVER_STREAMING,
  MCAPI_Types_pb.GetValuesRequest,
  MCAPI_Types_pb.GetValuesResponse,
  /**
   * @param {!proto.mcapi.GetValuesRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetValuesResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetValuesRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetValuesResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getValues =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetValues',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetValues);
};


/**
 * @param {!proto.mcapi.GetValuesRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetValuesResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIPromiseClient.prototype.getValues =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetValues',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetValues);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetAppInfoRequest,
 *   !proto.mcapi.GetAppInfoResponse>}
 */
const methodDescriptor_MCAPI_GetAppInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetAppInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetAppInfoRequest,
  MCAPI_Types_pb.GetAppInfoResponse,
  /**
   * @param {!proto.mcapi.GetAppInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetAppInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetAppInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetAppInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetAppInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getAppInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetAppInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetAppInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetAppInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetAppInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getAppInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetAppInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetAppInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetHostInfoRequest,
 *   !proto.mcapi.GetHostInfoResponse>}
 */
const methodDescriptor_MCAPI_GetHostInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetHostInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetHostInfoRequest,
  MCAPI_Types_pb.GetHostInfoResponse,
  /**
   * @param {!proto.mcapi.GetHostInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetHostInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetHostInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetHostInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetHostInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getHostInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetHostInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetHostInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetHostInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetHostInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getHostInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetHostInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetHostInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetBinsRequest,
 *   !proto.mcapi.GetBinsResponse>}
 */
const methodDescriptor_MCAPI_GetBins = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetBins',
  grpc.web.MethodType.SERVER_STREAMING,
  MCAPI_Types_pb.GetBinsRequest,
  MCAPI_Types_pb.GetBinsResponse,
  /**
   * @param {!proto.mcapi.GetBinsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetBinsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetBinsRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetBinsResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getBins =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetBins',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBins);
};


/**
 * @param {!proto.mcapi.GetBinsRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetBinsResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIPromiseClient.prototype.getBins =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetBins',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBins);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetBinInfoRequest,
 *   !proto.mcapi.GetBinInfoResponse>}
 */
const methodDescriptor_MCAPI_GetBinInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetBinInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetBinInfoRequest,
  MCAPI_Types_pb.GetBinInfoResponse,
  /**
   * @param {!proto.mcapi.GetBinInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetBinInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetBinInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetBinInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetBinInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getBinInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetBinInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetBinInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getBinInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetBinColumnInfoRequest,
 *   !proto.mcapi.GetBinColumnInfoResponse>}
 */
const methodDescriptor_MCAPI_GetBinColumnInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetBinColumnInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetBinColumnInfoRequest,
  MCAPI_Types_pb.GetBinColumnInfoResponse,
  /**
   * @param {!proto.mcapi.GetBinColumnInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetBinColumnInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetBinColumnInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetBinColumnInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetBinColumnInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getBinColumnInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinColumnInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinColumnInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetBinColumnInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetBinColumnInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getBinColumnInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinColumnInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinColumnInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetMobInfoRequest,
 *   !proto.mcapi.GetMobInfoResponse>}
 */
const methodDescriptor_MCAPI_GetMobInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetMobInfo',
  grpc.web.MethodType.SERVER_STREAMING,
  MCAPI_Types_pb.GetMobInfoRequest,
  MCAPI_Types_pb.GetMobInfoResponse,
  /**
   * @param {!proto.mcapi.GetMobInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetMobInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetMobInfoRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMobInfoResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getMobInfo =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetMobInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMobInfo);
};


/**
 * @param {!proto.mcapi.GetMobInfoRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMobInfoResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIPromiseClient.prototype.getMobInfo =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetMobInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMobInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.SetMobInfoRequest,
 *   !proto.mcapi.SetMobInfoResponse>}
 */
const methodDescriptor_MCAPI_SetMobInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/SetMobInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.SetMobInfoRequest,
  MCAPI_Types_pb.SetMobInfoResponse,
  /**
   * @param {!proto.mcapi.SetMobInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.SetMobInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.SetMobInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.SetMobInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.SetMobInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.setMobInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/SetMobInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetMobInfo,
      callback);
};


/**
 * @param {!proto.mcapi.SetMobInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.SetMobInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.setMobInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/SetMobInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetMobInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetMobTrackInfoRequest,
 *   !proto.mcapi.GetMobTrackInfoResponse>}
 */
const methodDescriptor_MCAPI_GetMobTrackInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetMobTrackInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetMobTrackInfoRequest,
  MCAPI_Types_pb.GetMobTrackInfoResponse,
  /**
   * @param {!proto.mcapi.GetMobTrackInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetMobTrackInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetMobTrackInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetMobTrackInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMobTrackInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getMobTrackInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetMobTrackInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMobTrackInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetMobTrackInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetMobTrackInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getMobTrackInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetMobTrackInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMobTrackInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CreateBinRequest,
 *   !proto.mcapi.CreateBinResponse>}
 */
const methodDescriptor_MCAPI_CreateBin = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CreateBin',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CreateBinRequest,
  MCAPI_Types_pb.CreateBinResponse,
  /**
   * @param {!proto.mcapi.CreateBinRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CreateBinResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CreateBinRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CreateBinResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CreateBinResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.createBin =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CreateBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateBin,
      callback);
};


/**
 * @param {!proto.mcapi.CreateBinRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CreateBinResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.createBin =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CreateBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateBin);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.OpenBinRequest,
 *   !proto.mcapi.OpenBinResponse>}
 */
const methodDescriptor_MCAPI_OpenBin = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/OpenBin',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.OpenBinRequest,
  MCAPI_Types_pb.OpenBinResponse,
  /**
   * @param {!proto.mcapi.OpenBinRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.OpenBinResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.OpenBinRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.OpenBinResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.OpenBinResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.openBin =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/OpenBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_OpenBin,
      callback);
};


/**
 * @param {!proto.mcapi.OpenBinRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.OpenBinResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.openBin =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/OpenBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_OpenBin);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ConfigureSRTStreamRequest,
 *   !proto.mcapi.ConfigureSRTStreamResponse>}
 */
const methodDescriptor_MCAPI_ConfigureSRTStream = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ConfigureSRTStream',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ConfigureSRTStreamRequest,
  MCAPI_Types_pb.ConfigureSRTStreamResponse,
  /**
   * @param {!proto.mcapi.ConfigureSRTStreamRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ConfigureSRTStreamResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ConfigureSRTStreamRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ConfigureSRTStreamResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ConfigureSRTStreamResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.configureSRTStream =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ConfigureSRTStream',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ConfigureSRTStream,
      callback);
};


/**
 * @param {!proto.mcapi.ConfigureSRTStreamRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ConfigureSRTStreamResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.configureSRTStream =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ConfigureSRTStream',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ConfigureSRTStream);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetSRTStreamSettingsRequest,
 *   !proto.mcapi.GetSRTStreamSettingsResponse>}
 */
const methodDescriptor_MCAPI_GetSRTStreamSettings = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetSRTStreamSettings',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetSRTStreamSettingsRequest,
  MCAPI_Types_pb.GetSRTStreamSettingsResponse,
  /**
   * @param {!proto.mcapi.GetSRTStreamSettingsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetSRTStreamSettingsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetSRTStreamSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetSRTStreamSettingsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetSRTStreamSettingsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getSRTStreamSettings =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetSRTStreamSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetSRTStreamSettings,
      callback);
};


/**
 * @param {!proto.mcapi.GetSRTStreamSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetSRTStreamSettingsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getSRTStreamSettings =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetSRTStreamSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetSRTStreamSettings);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.SetOTSSessionStatusRequest,
 *   !proto.mcapi.SetOTSSessionStatusResponse>}
 */
const methodDescriptor_MCAPI_SetOTSSessionStatus = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/SetOTSSessionStatus',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.SetOTSSessionStatusRequest,
  MCAPI_Types_pb.SetOTSSessionStatusResponse,
  /**
   * @param {!proto.mcapi.SetOTSSessionStatusRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.SetOTSSessionStatusResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.SetOTSSessionStatusRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.SetOTSSessionStatusResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.SetOTSSessionStatusResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.setOTSSessionStatus =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/SetOTSSessionStatus',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetOTSSessionStatus,
      callback);
};


/**
 * @param {!proto.mcapi.SetOTSSessionStatusRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.SetOTSSessionStatusResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.setOTSSessionStatus =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/SetOTSSessionStatus',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetOTSSessionStatus);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetOTSSessionStatusRequest,
 *   !proto.mcapi.GetOTSSessionStatusResponse>}
 */
const methodDescriptor_MCAPI_GetOTSSessionStatus = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetOTSSessionStatus',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetOTSSessionStatusRequest,
  MCAPI_Types_pb.GetOTSSessionStatusResponse,
  /**
   * @param {!proto.mcapi.GetOTSSessionStatusRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetOTSSessionStatusResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetOTSSessionStatusRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetOTSSessionStatusResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetOTSSessionStatusResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getOTSSessionStatus =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetOTSSessionStatus',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetOTSSessionStatus,
      callback);
};


/**
 * @param {!proto.mcapi.GetOTSSessionStatusRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetOTSSessionStatusResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getOTSSessionStatus =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetOTSSessionStatus',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetOTSSessionStatus);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetMediaVolumeListRequest,
 *   !proto.mcapi.GetMediaVolumeListResponse>}
 */
const methodDescriptor_MCAPI_GetMediaVolumeList = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetMediaVolumeList',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetMediaVolumeListRequest,
  MCAPI_Types_pb.GetMediaVolumeListResponse,
  /**
   * @param {!proto.mcapi.GetMediaVolumeListRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetMediaVolumeListResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetMediaVolumeListRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetMediaVolumeListResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMediaVolumeListResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getMediaVolumeList =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetMediaVolumeList',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMediaVolumeList,
      callback);
};


/**
 * @param {!proto.mcapi.GetMediaVolumeListRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetMediaVolumeListResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getMediaVolumeList =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetMediaVolumeList',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMediaVolumeList);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetMediaVolumeItemsRequest,
 *   !proto.mcapi.GetMediaVolumeItemsResponse>}
 */
const methodDescriptor_MCAPI_GetMediaVolumeItems = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetMediaVolumeItems',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetMediaVolumeItemsRequest,
  MCAPI_Types_pb.GetMediaVolumeItemsResponse,
  /**
   * @param {!proto.mcapi.GetMediaVolumeItemsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetMediaVolumeItemsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetMediaVolumeItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetMediaVolumeItemsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMediaVolumeItemsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getMediaVolumeItems =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetMediaVolumeItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMediaVolumeItems,
      callback);
};


/**
 * @param {!proto.mcapi.GetMediaVolumeItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetMediaVolumeItemsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getMediaVolumeItems =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetMediaVolumeItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMediaVolumeItems);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfBinItemsRequest,
 *   !proto.mcapi.GetListOfBinItemsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfBinItems = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfBinItems',
  grpc.web.MethodType.SERVER_STREAMING,
  MCAPI_Types_pb.GetListOfBinItemsRequest,
  MCAPI_Types_pb.GetListOfBinItemsResponse,
  /**
   * @param {!proto.mcapi.GetListOfBinItemsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfBinItemsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfBinItemsRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfBinItemsResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfBinItems =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetListOfBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfBinItems);
};


/**
 * @param {!proto.mcapi.GetListOfBinItemsRequest} request The request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfBinItemsResponse>}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfBinItems =
    function(request, metadata) {
  return this.client_.serverStreaming(this.hostname_ +
      '/mcapi.MCAPI/GetListOfBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfBinItems);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetOpenProjectInfoRequest,
 *   !proto.mcapi.GetOpenProjectInfoResponse>}
 */
const methodDescriptor_MCAPI_GetOpenProjectInfo = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetOpenProjectInfo',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetOpenProjectInfoRequest,
  MCAPI_Types_pb.GetOpenProjectInfoResponse,
  /**
   * @param {!proto.mcapi.GetOpenProjectInfoRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetOpenProjectInfoResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetOpenProjectInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetOpenProjectInfoResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetOpenProjectInfoResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getOpenProjectInfo =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetOpenProjectInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetOpenProjectInfo,
      callback);
};


/**
 * @param {!proto.mcapi.GetOpenProjectInfoRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetOpenProjectInfoResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getOpenProjectInfo =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetOpenProjectInfo',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetOpenProjectInfo);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetCustomProjectDataRequest,
 *   !proto.mcapi.GetCustomProjectDataResponse>}
 */
const methodDescriptor_MCAPI_GetCustomProjectData = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetCustomProjectData',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetCustomProjectDataRequest,
  MCAPI_Types_pb.GetCustomProjectDataResponse,
  /**
   * @param {!proto.mcapi.GetCustomProjectDataRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetCustomProjectDataResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetCustomProjectDataRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetCustomProjectDataResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetCustomProjectDataResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getCustomProjectData =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetCustomProjectData',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetCustomProjectData,
      callback);
};


/**
 * @param {!proto.mcapi.GetCustomProjectDataRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetCustomProjectDataResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getCustomProjectData =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetCustomProjectData',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetCustomProjectData);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.SetCustomProjectDataRequest,
 *   !proto.mcapi.SetCustomProjectDataResponse>}
 */
const methodDescriptor_MCAPI_SetCustomProjectData = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/SetCustomProjectData',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.SetCustomProjectDataRequest,
  MCAPI_Types_pb.SetCustomProjectDataResponse,
  /**
   * @param {!proto.mcapi.SetCustomProjectDataRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.SetCustomProjectDataResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.SetCustomProjectDataRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.SetCustomProjectDataResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.SetCustomProjectDataResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.setCustomProjectData =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/SetCustomProjectData',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetCustomProjectData,
      callback);
};


/**
 * @param {!proto.mcapi.SetCustomProjectDataRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.SetCustomProjectDataResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.setCustomProjectData =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/SetCustomProjectData',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetCustomProjectData);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ScanAvidMediaFilesFolderRequest,
 *   !proto.mcapi.ScanAvidMediaFilesFolderResponse>}
 */
const methodDescriptor_MCAPI_ScanAvidMediaFilesFolder = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ScanAvidMediaFilesFolder',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ScanAvidMediaFilesFolderRequest,
  MCAPI_Types_pb.ScanAvidMediaFilesFolderResponse,
  /**
   * @param {!proto.mcapi.ScanAvidMediaFilesFolderRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ScanAvidMediaFilesFolderResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ScanAvidMediaFilesFolderRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ScanAvidMediaFilesFolderResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ScanAvidMediaFilesFolderResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.scanAvidMediaFilesFolder =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ScanAvidMediaFilesFolder',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ScanAvidMediaFilesFolder,
      callback);
};


/**
 * @param {!proto.mcapi.ScanAvidMediaFilesFolderRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ScanAvidMediaFilesFolderResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.scanAvidMediaFilesFolder =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ScanAvidMediaFilesFolder',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ScanAvidMediaFilesFolder);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CreateClipsFromAvidMediaFilesFolderRequest,
 *   !proto.mcapi.CreateClipsFromAvidMediaFilesFolderResponse>}
 */
const methodDescriptor_MCAPI_CreateClipsFromAvidMediaFilesFolder = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CreateClipsFromAvidMediaFilesFolder',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CreateClipsFromAvidMediaFilesFolderRequest,
  MCAPI_Types_pb.CreateClipsFromAvidMediaFilesFolderResponse,
  /**
   * @param {!proto.mcapi.CreateClipsFromAvidMediaFilesFolderRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CreateClipsFromAvidMediaFilesFolderResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CreateClipsFromAvidMediaFilesFolderRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CreateClipsFromAvidMediaFilesFolderResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CreateClipsFromAvidMediaFilesFolderResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.createClipsFromAvidMediaFilesFolder =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CreateClipsFromAvidMediaFilesFolder',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateClipsFromAvidMediaFilesFolder,
      callback);
};


/**
 * @param {!proto.mcapi.CreateClipsFromAvidMediaFilesFolderRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CreateClipsFromAvidMediaFilesFolderResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.createClipsFromAvidMediaFilesFolder =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CreateClipsFromAvidMediaFilesFolder',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateClipsFromAvidMediaFilesFolder);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CreateCustomColumnRequest,
 *   !proto.mcapi.CreateCustomColumnResponse>}
 */
const methodDescriptor_MCAPI_CreateCustomColumn = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CreateCustomColumn',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CreateCustomColumnRequest,
  MCAPI_Types_pb.CreateCustomColumnResponse,
  /**
   * @param {!proto.mcapi.CreateCustomColumnRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CreateCustomColumnResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CreateCustomColumnRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CreateCustomColumnResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CreateCustomColumnResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.createCustomColumn =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CreateCustomColumn',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateCustomColumn,
      callback);
};


/**
 * @param {!proto.mcapi.CreateCustomColumnRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CreateCustomColumnResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.createCustomColumn =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CreateCustomColumn',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateCustomColumn);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfImportSettingsRequest,
 *   !proto.mcapi.GetListOfImportSettingsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfImportSettings = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfImportSettings',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfImportSettingsRequest,
  MCAPI_Types_pb.GetListOfImportSettingsResponse,
  /**
   * @param {!proto.mcapi.GetListOfImportSettingsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfImportSettingsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfImportSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfImportSettingsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfImportSettingsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfImportSettings =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfImportSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfImportSettings,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfImportSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfImportSettingsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfImportSettings =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfImportSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfImportSettings);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ImportFileRequest,
 *   !proto.mcapi.ImportFileResponse>}
 */
const methodDescriptor_MCAPI_ImportFile = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ImportFile',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ImportFileRequest,
  MCAPI_Types_pb.ImportFileResponse,
  /**
   * @param {!proto.mcapi.ImportFileRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ImportFileResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ImportFileRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ImportFileResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ImportFileResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.importFile =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ImportFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ImportFile,
      callback);
};


/**
 * @param {!proto.mcapi.ImportFileRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ImportFileResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.importFile =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ImportFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ImportFile);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfExportEDLSettingsRequest,
 *   !proto.mcapi.GetListOfExportEDLSettingsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfExportEDLSettings = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfExportEDLSettings',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfExportEDLSettingsRequest,
  MCAPI_Types_pb.GetListOfExportEDLSettingsResponse,
  /**
   * @param {!proto.mcapi.GetListOfExportEDLSettingsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfExportEDLSettingsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfExportEDLSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfExportEDLSettingsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfExportEDLSettingsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfExportEDLSettings =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfExportEDLSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfExportEDLSettings,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfExportEDLSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfExportEDLSettingsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfExportEDLSettings =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfExportEDLSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfExportEDLSettings);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ExportEDLRequest,
 *   !proto.mcapi.ExportEDLResponse>}
 */
const methodDescriptor_MCAPI_ExportEDL = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ExportEDL',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ExportEDLRequest,
  MCAPI_Types_pb.ExportEDLResponse,
  /**
   * @param {!proto.mcapi.ExportEDLRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ExportEDLResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ExportEDLRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ExportEDLResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ExportEDLResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.exportEDL =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ExportEDL',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ExportEDL,
      callback);
};


/**
 * @param {!proto.mcapi.ExportEDLRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ExportEDLResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.exportEDL =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ExportEDL',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ExportEDL);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfExportSettingsRequest,
 *   !proto.mcapi.GetListOfExportSettingsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfExportSettings = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfExportSettings',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfExportSettingsRequest,
  MCAPI_Types_pb.GetListOfExportSettingsResponse,
  /**
   * @param {!proto.mcapi.GetListOfExportSettingsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfExportSettingsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfExportSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfExportSettingsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfExportSettingsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfExportSettings =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfExportSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfExportSettings,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfExportSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfExportSettingsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfExportSettings =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfExportSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfExportSettings);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ExportFileRequest,
 *   !proto.mcapi.ExportFileResponse>}
 */
const methodDescriptor_MCAPI_ExportFile = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ExportFile',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ExportFileRequest,
  MCAPI_Types_pb.ExportFileResponse,
  /**
   * @param {!proto.mcapi.ExportFileRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ExportFileResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ExportFileRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ExportFileResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ExportFileResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.exportFile =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ExportFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ExportFile,
      callback);
};


/**
 * @param {!proto.mcapi.ExportFileRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ExportFileResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.exportFile =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ExportFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ExportFile);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.LoadSettingRequest,
 *   !proto.mcapi.LoadSettingResponse>}
 */
const methodDescriptor_MCAPI_LoadSetting = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/LoadSetting',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.LoadSettingRequest,
  MCAPI_Types_pb.LoadSettingResponse,
  /**
   * @param {!proto.mcapi.LoadSettingRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.LoadSettingResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.LoadSettingRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.LoadSettingResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.LoadSettingResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.loadSetting =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/LoadSetting',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LoadSetting,
      callback);
};


/**
 * @param {!proto.mcapi.LoadSettingRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.LoadSettingResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.loadSetting =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/LoadSetting',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LoadSetting);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.LoadMobsIntoViewerRequest,
 *   !proto.mcapi.LoadMobsIntoViewerResponse>}
 */
const methodDescriptor_MCAPI_LoadMobsIntoViewer = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/LoadMobsIntoViewer',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.LoadMobsIntoViewerRequest,
  MCAPI_Types_pb.LoadMobsIntoViewerResponse,
  /**
   * @param {!proto.mcapi.LoadMobsIntoViewerRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.LoadMobsIntoViewerResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.LoadMobsIntoViewerRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.LoadMobsIntoViewerResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.LoadMobsIntoViewerResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.loadMobsIntoViewer =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/LoadMobsIntoViewer',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LoadMobsIntoViewer,
      callback);
};


/**
 * @param {!proto.mcapi.LoadMobsIntoViewerRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.LoadMobsIntoViewerResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.loadMobsIntoViewer =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/LoadMobsIntoViewer',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LoadMobsIntoViewer);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.SelectMobsInBinRequest,
 *   !proto.mcapi.SelectMobsInBinResponse>}
 */
const methodDescriptor_MCAPI_SelectMobsInBin = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/SelectMobsInBin',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.SelectMobsInBinRequest,
  MCAPI_Types_pb.SelectMobsInBinResponse,
  /**
   * @param {!proto.mcapi.SelectMobsInBinRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.SelectMobsInBinResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.SelectMobsInBinRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.SelectMobsInBinResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.SelectMobsInBinResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.selectMobsInBin =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/SelectMobsInBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SelectMobsInBin,
      callback);
};


/**
 * @param {!proto.mcapi.SelectMobsInBinRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.SelectMobsInBinResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.selectMobsInBin =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/SelectMobsInBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SelectMobsInBin);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetViewerMobsRequest,
 *   !proto.mcapi.GetViewerMobsResponse>}
 */
const methodDescriptor_MCAPI_GetViewerMobs = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetViewerMobs',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetViewerMobsRequest,
  MCAPI_Types_pb.GetViewerMobsResponse,
  /**
   * @param {!proto.mcapi.GetViewerMobsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetViewerMobsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetViewerMobsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetViewerMobsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetViewerMobsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getViewerMobs =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetViewerMobs',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetViewerMobs,
      callback);
};


/**
 * @param {!proto.mcapi.GetViewerMobsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetViewerMobsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getViewerMobs =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetViewerMobs',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetViewerMobs);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetBinFromMobRequest,
 *   !proto.mcapi.GetBinFromMobResponse>}
 */
const methodDescriptor_MCAPI_GetBinFromMob = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetBinFromMob',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetBinFromMobRequest,
  MCAPI_Types_pb.GetBinFromMobResponse,
  /**
   * @param {!proto.mcapi.GetBinFromMobRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetBinFromMobResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetBinFromMobRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetBinFromMobResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetBinFromMobResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getBinFromMob =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinFromMob',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinFromMob,
      callback);
};


/**
 * @param {!proto.mcapi.GetBinFromMobRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetBinFromMobResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getBinFromMob =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetBinFromMob',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetBinFromMob);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.AddMarkerRequest,
 *   !proto.mcapi.AddMarkerResponse>}
 */
const methodDescriptor_MCAPI_AddMarker = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/AddMarker',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.AddMarkerRequest,
  MCAPI_Types_pb.AddMarkerResponse,
  /**
   * @param {!proto.mcapi.AddMarkerRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.AddMarkerResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.AddMarkerRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.AddMarkerResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.AddMarkerResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.addMarker =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/AddMarker',
      request,
      metadata || {},
      methodDescriptor_MCAPI_AddMarker,
      callback);
};


/**
 * @param {!proto.mcapi.AddMarkerRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.AddMarkerResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.addMarker =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/AddMarker',
      request,
      metadata || {},
      methodDescriptor_MCAPI_AddMarker);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.AddMarkersRequest,
 *   !proto.mcapi.AddMarkersResponse>}
 */
const methodDescriptor_MCAPI_AddMarkers = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/AddMarkers',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.AddMarkersRequest,
  MCAPI_Types_pb.AddMarkersResponse,
  /**
   * @param {!proto.mcapi.AddMarkersRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.AddMarkersResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.AddMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.AddMarkersResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.AddMarkersResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.addMarkers =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/AddMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_AddMarkers,
      callback);
};


/**
 * @param {!proto.mcapi.AddMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.AddMarkersResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.addMarkers =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/AddMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_AddMarkers);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetMarkersRequest,
 *   !proto.mcapi.GetMarkersResponse>}
 */
const methodDescriptor_MCAPI_GetMarkers = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetMarkers',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetMarkersRequest,
  MCAPI_Types_pb.GetMarkersResponse,
  /**
   * @param {!proto.mcapi.GetMarkersRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetMarkersResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetMarkersResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetMarkersResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getMarkers =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMarkers,
      callback);
};


/**
 * @param {!proto.mcapi.GetMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetMarkersResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getMarkers =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetMarkers);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.ChangeMarkerRequest,
 *   !proto.mcapi.ChangeMarkerResponse>}
 */
const methodDescriptor_MCAPI_ChangeMarker = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/ChangeMarker',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.ChangeMarkerRequest,
  MCAPI_Types_pb.ChangeMarkerResponse,
  /**
   * @param {!proto.mcapi.ChangeMarkerRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.ChangeMarkerResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.ChangeMarkerRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.ChangeMarkerResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.ChangeMarkerResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.changeMarker =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/ChangeMarker',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ChangeMarker,
      callback);
};


/**
 * @param {!proto.mcapi.ChangeMarkerRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.ChangeMarkerResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.changeMarker =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/ChangeMarker',
      request,
      metadata || {},
      methodDescriptor_MCAPI_ChangeMarker);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.DeleteMarkersRequest,
 *   !proto.mcapi.DeleteMarkersResponse>}
 */
const methodDescriptor_MCAPI_DeleteMarkers = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/DeleteMarkers',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.DeleteMarkersRequest,
  MCAPI_Types_pb.DeleteMarkersResponse,
  /**
   * @param {!proto.mcapi.DeleteMarkersRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.DeleteMarkersResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.DeleteMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.DeleteMarkersResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.DeleteMarkersResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.deleteMarkers =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/DeleteMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DeleteMarkers,
      callback);
};


/**
 * @param {!proto.mcapi.DeleteMarkersRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.DeleteMarkersResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.deleteMarkers =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/DeleteMarkers',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DeleteMarkers);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CreateSubClipRequest,
 *   !proto.mcapi.CreateSubClipResponse>}
 */
const methodDescriptor_MCAPI_CreateSubClip = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CreateSubClip',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CreateSubClipRequest,
  MCAPI_Types_pb.CreateSubClipResponse,
  /**
   * @param {!proto.mcapi.CreateSubClipRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CreateSubClipResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CreateSubClipRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CreateSubClipResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CreateSubClipResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.createSubClip =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CreateSubClip',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateSubClip,
      callback);
};


/**
 * @param {!proto.mcapi.CreateSubClipRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CreateSubClipResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.createSubClip =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CreateSubClip',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CreateSubClip);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CloseBinRequest,
 *   !proto.mcapi.CloseBinResponse>}
 */
const methodDescriptor_MCAPI_CloseBin = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CloseBin',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CloseBinRequest,
  MCAPI_Types_pb.CloseBinResponse,
  /**
   * @param {!proto.mcapi.CloseBinRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CloseBinResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CloseBinRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CloseBinResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CloseBinResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.closeBin =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CloseBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CloseBin,
      callback);
};


/**
 * @param {!proto.mcapi.CloseBinRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CloseBinResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.closeBin =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CloseBin',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CloseBin);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.MoveBinItemsRequest,
 *   !proto.mcapi.MoveBinItemsResponse>}
 */
const methodDescriptor_MCAPI_MoveBinItems = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/MoveBinItems',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.MoveBinItemsRequest,
  MCAPI_Types_pb.MoveBinItemsResponse,
  /**
   * @param {!proto.mcapi.MoveBinItemsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.MoveBinItemsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.MoveBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.MoveBinItemsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.MoveBinItemsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.moveBinItems =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/MoveBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_MoveBinItems,
      callback);
};


/**
 * @param {!proto.mcapi.MoveBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.MoveBinItemsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.moveBinItems =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/MoveBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_MoveBinItems);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.CopyBinItemsRequest,
 *   !proto.mcapi.CopyBinItemsResponse>}
 */
const methodDescriptor_MCAPI_CopyBinItems = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/CopyBinItems',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.CopyBinItemsRequest,
  MCAPI_Types_pb.CopyBinItemsResponse,
  /**
   * @param {!proto.mcapi.CopyBinItemsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.CopyBinItemsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.CopyBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.CopyBinItemsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.CopyBinItemsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.copyBinItems =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/CopyBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CopyBinItems,
      callback);
};


/**
 * @param {!proto.mcapi.CopyBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.CopyBinItemsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.copyBinItems =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/CopyBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_CopyBinItems);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.DuplicateBinItemsRequest,
 *   !proto.mcapi.DuplicateBinItemsResponse>}
 */
const methodDescriptor_MCAPI_DuplicateBinItems = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/DuplicateBinItems',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.DuplicateBinItemsRequest,
  MCAPI_Types_pb.DuplicateBinItemsResponse,
  /**
   * @param {!proto.mcapi.DuplicateBinItemsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.DuplicateBinItemsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.DuplicateBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.DuplicateBinItemsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.DuplicateBinItemsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.duplicateBinItems =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/DuplicateBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DuplicateBinItems,
      callback);
};


/**
 * @param {!proto.mcapi.DuplicateBinItemsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.DuplicateBinItemsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.duplicateBinItems =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/DuplicateBinItems',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DuplicateBinItems);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfLinkSettingsRequest,
 *   !proto.mcapi.GetListOfLinkSettingsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfLinkSettings = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfLinkSettings',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfLinkSettingsRequest,
  MCAPI_Types_pb.GetListOfLinkSettingsResponse,
  /**
   * @param {!proto.mcapi.GetListOfLinkSettingsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfLinkSettingsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfLinkSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfLinkSettingsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfLinkSettingsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfLinkSettings =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfLinkSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfLinkSettings,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfLinkSettingsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfLinkSettingsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfLinkSettings =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfLinkSettings',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfLinkSettings);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.LinkFileRequest,
 *   !proto.mcapi.LinkFileResponse>}
 */
const methodDescriptor_MCAPI_LinkFile = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/LinkFile',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.LinkFileRequest,
  MCAPI_Types_pb.LinkFileResponse,
  /**
   * @param {!proto.mcapi.LinkFileRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.LinkFileResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.LinkFileRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.LinkFileResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.LinkFileResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.linkFile =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/LinkFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LinkFile,
      callback);
};


/**
 * @param {!proto.mcapi.LinkFileRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.LinkFileResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.linkFile =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/LinkFile',
      request,
      metadata || {},
      methodDescriptor_MCAPI_LinkFile);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfJobQueuesRequest,
 *   !proto.mcapi.GetListOfJobQueuesResponse>}
 */
const methodDescriptor_MCAPI_GetListOfJobQueues = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfJobQueues',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfJobQueuesRequest,
  MCAPI_Types_pb.GetListOfJobQueuesResponse,
  /**
   * @param {!proto.mcapi.GetListOfJobQueuesRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfJobQueuesResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfJobQueuesRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfJobQueuesResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfJobQueuesResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfJobQueues =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfJobQueues',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfJobQueues,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfJobQueuesRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfJobQueuesResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfJobQueues =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfJobQueues',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfJobQueues);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfCommandsRequest,
 *   !proto.mcapi.GetListOfCommandsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfCommands = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfCommands',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfCommandsRequest,
  MCAPI_Types_pb.GetListOfCommandsResponse,
  /**
   * @param {!proto.mcapi.GetListOfCommandsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfCommandsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfCommandsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfCommandsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfCommandsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfCommands =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfCommands',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfCommands,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfCommandsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfCommandsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfCommands =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfCommands',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfCommands);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.DoCommandRequest,
 *   !proto.mcapi.DoCommandResponse>}
 */
const methodDescriptor_MCAPI_DoCommand = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/DoCommand',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.DoCommandRequest,
  MCAPI_Types_pb.DoCommandResponse,
  /**
   * @param {!proto.mcapi.DoCommandRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.DoCommandResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.DoCommandRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.DoCommandResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.DoCommandResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.doCommand =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/DoCommand',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DoCommand,
      callback);
};


/**
 * @param {!proto.mcapi.DoCommandRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.DoCommandResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.doCommand =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/DoCommand',
      request,
      metadata || {},
      methodDescriptor_MCAPI_DoCommand);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.IsCommandsEnabledRequest,
 *   !proto.mcapi.IsCommandsEnabledResponse>}
 */
const methodDescriptor_MCAPI_IsCommandsEnabled = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/IsCommandsEnabled',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.IsCommandsEnabledRequest,
  MCAPI_Types_pb.IsCommandsEnabledResponse,
  /**
   * @param {!proto.mcapi.IsCommandsEnabledRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.IsCommandsEnabledResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.IsCommandsEnabledRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.IsCommandsEnabledResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.IsCommandsEnabledResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.isCommandsEnabled =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/IsCommandsEnabled',
      request,
      metadata || {},
      methodDescriptor_MCAPI_IsCommandsEnabled,
      callback);
};


/**
 * @param {!proto.mcapi.IsCommandsEnabledRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.IsCommandsEnabledResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.isCommandsEnabled =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/IsCommandsEnabled',
      request,
      metadata || {},
      methodDescriptor_MCAPI_IsCommandsEnabled);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.StartPlayRequest,
 *   !proto.mcapi.StartPlayResponse>}
 */
const methodDescriptor_MCAPI_StartPlay = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/StartPlay',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.StartPlayRequest,
  MCAPI_Types_pb.StartPlayResponse,
  /**
   * @param {!proto.mcapi.StartPlayRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.StartPlayResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.StartPlayRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.StartPlayResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.StartPlayResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.startPlay =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/StartPlay',
      request,
      metadata || {},
      methodDescriptor_MCAPI_StartPlay,
      callback);
};


/**
 * @param {!proto.mcapi.StartPlayRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.StartPlayResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.startPlay =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/StartPlay',
      request,
      metadata || {},
      methodDescriptor_MCAPI_StartPlay);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.StopPlayRequest,
 *   !proto.mcapi.StopPlayResponse>}
 */
const methodDescriptor_MCAPI_StopPlay = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/StopPlay',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.StopPlayRequest,
  MCAPI_Types_pb.StopPlayResponse,
  /**
   * @param {!proto.mcapi.StopPlayRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.StopPlayResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.StopPlayRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.StopPlayResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.StopPlayResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.stopPlay =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/StopPlay',
      request,
      metadata || {},
      methodDescriptor_MCAPI_StopPlay,
      callback);
};


/**
 * @param {!proto.mcapi.StopPlayRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.StopPlayResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.stopPlay =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/StopPlay',
      request,
      metadata || {},
      methodDescriptor_MCAPI_StopPlay);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.SetPositionRequest,
 *   !proto.mcapi.SetPositionResponse>}
 */
const methodDescriptor_MCAPI_SetPosition = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/SetPosition',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.SetPositionRequest,
  MCAPI_Types_pb.SetPositionResponse,
  /**
   * @param {!proto.mcapi.SetPositionRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.SetPositionResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.SetPositionRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.SetPositionResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.SetPositionResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.setPosition =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/SetPosition',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetPosition,
      callback);
};


/**
 * @param {!proto.mcapi.SetPositionRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.SetPositionResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.setPosition =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/SetPosition',
      request,
      metadata || {},
      methodDescriptor_MCAPI_SetPosition);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfWindowsRequest,
 *   !proto.mcapi.GetListOfWindowsResponse>}
 */
const methodDescriptor_MCAPI_GetListOfWindows = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfWindows',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfWindowsRequest,
  MCAPI_Types_pb.GetListOfWindowsResponse,
  /**
   * @param {!proto.mcapi.GetListOfWindowsRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfWindowsResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfWindowsRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfWindowsResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfWindowsResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfWindows =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfWindows',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfWindows,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfWindowsRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfWindowsResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfWindows =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfWindows',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfWindows);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.GetListOfSequenceTemplatesRequest,
 *   !proto.mcapi.GetListOfSequenceTemplatesResponse>}
 */
const methodDescriptor_MCAPI_GetListOfSequenceTemplates = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/GetListOfSequenceTemplates',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.GetListOfSequenceTemplatesRequest,
  MCAPI_Types_pb.GetListOfSequenceTemplatesResponse,
  /**
   * @param {!proto.mcapi.GetListOfSequenceTemplatesRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.GetListOfSequenceTemplatesResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.GetListOfSequenceTemplatesRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.GetListOfSequenceTemplatesResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.GetListOfSequenceTemplatesResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.getListOfSequenceTemplates =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfSequenceTemplates',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfSequenceTemplates,
      callback);
};


/**
 * @param {!proto.mcapi.GetListOfSequenceTemplatesRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.GetListOfSequenceTemplatesResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.getListOfSequenceTemplates =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/GetListOfSequenceTemplates',
      request,
      metadata || {},
      methodDescriptor_MCAPI_GetListOfSequenceTemplates);
};


/**
 * @const
 * @type {!grpc.web.MethodDescriptor<
 *   !proto.mcapi.MakeActiveWindowRequest,
 *   !proto.mcapi.MakeActiveWindowResponse>}
 */
const methodDescriptor_MCAPI_MakeActiveWindow = new grpc.web.MethodDescriptor(
  '/mcapi.MCAPI/MakeActiveWindow',
  grpc.web.MethodType.UNARY,
  MCAPI_Types_pb.MakeActiveWindowRequest,
  MCAPI_Types_pb.MakeActiveWindowResponse,
  /**
   * @param {!proto.mcapi.MakeActiveWindowRequest} request
   * @return {!Uint8Array}
   */
  function(request) {
    return request.serializeBinary();
  },
  MCAPI_Types_pb.MakeActiveWindowResponse.deserializeBinary
);


/**
 * @param {!proto.mcapi.MakeActiveWindowRequest} request The
 *     request proto
 * @param {?Object<string, string>} metadata User defined
 *     call metadata
 * @param {function(?grpc.web.RpcError, ?proto.mcapi.MakeActiveWindowResponse)}
 *     callback The callback function(error, response)
 * @return {!grpc.web.ClientReadableStream<!proto.mcapi.MakeActiveWindowResponse>|undefined}
 *     The XHR Node Readable Stream
 */
proto.mcapi.MCAPIClient.prototype.makeActiveWindow =
    function(request, metadata, callback) {
  return this.client_.rpcCall(this.hostname_ +
      '/mcapi.MCAPI/MakeActiveWindow',
      request,
      metadata || {},
      methodDescriptor_MCAPI_MakeActiveWindow,
      callback);
};


/**
 * @param {!proto.mcapi.MakeActiveWindowRequest} request The
 *     request proto
 * @param {?Object<string, string>=} metadata User defined
 *     call metadata
 * @return {!Promise<!proto.mcapi.MakeActiveWindowResponse>}
 *     Promise that resolves to the response
 */
proto.mcapi.MCAPIPromiseClient.prototype.makeActiveWindow =
    function(request, metadata) {
  return this.client_.unaryCall(this.hostname_ +
      '/mcapi.MCAPI/MakeActiveWindow',
      request,
      metadata || {},
      methodDescriptor_MCAPI_MakeActiveWindow);
};


module.exports = proto.mcapi;

