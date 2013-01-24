/**
 * @fileoverview
 * @TODO file description
 *
 * @author Tadeusz Kozak
 * @date 26-06-2012 10:37
 */

/**
 * Streams quality configuration
 * @type {Object}
 */

ADLT.APPLICATION_ID = 1;

ADLT.APP_SHARED_SECRET = 'CloudeoTestAccountSecret';

/**
 * Configuration of the streams to publish upon connection established
 * @type {Object}
 */
ADLT.CONNECTION_CONFIGURATION = {

  /**
   * Description of the base line video stream - the low layer. It's QVGA, with
   * bitrate equal to 64kbps and 5 frames per second
   */
  lowVideoStream:{
    publish:true,
    receive:true,
    maxWidth:320,
    maxHeight:240,
    maxBitRate:64,
    maxFps:5
  },

  /**
   * Description of the adaptive video stream - the high layer. It's QVGA, with
   * 400kbps of bitrate and 15 frames per second
   */
  highVideoStream:{
    publish:true,
    receive:true,
    maxWidth:320,
    maxHeight:240,
    maxBitRate:400,
    maxFps:15
  },

  /**
   * Flags defining that both streams should be automatically published upon
   * connection.
   */
  autopublishVideo:true,
  autopublishAudio:true
};

ADLT.mediaConnType2Label = {};
ADLT.mediaConnType2Label[ADL.ConnectionType.NOT_CONNECTED] =
    'not connected';
ADLT.mediaConnType2Label[ADL.ConnectionType.TCP_RELAY] =
    'RTP/TCP relayed';
ADLT.mediaConnType2Label[ADL.ConnectionType.UDP_RELAY] =
    'RTP/UDP relayed';
ADLT.mediaConnType2Label[ADL.ConnectionType.UDP_P2P] =
    'RTP/UDP in P2P';


/**
 * Document ready callback - starts the AddLive platform initialization.
 */
ADLT.onDomReady = function () {
  log.debug('DOM loaded');
  ADLT.initAddLiveLogging();
  ADLT.initDevicesSelects();
  ADLT.initUI();
  var initOptions = {applicationId:ADLT.APPLICATION_ID};
  ADLT.initializeAddLiveQuick(ADLT.onPlatformReady, initOptions);
};

ADLT.initUI = function () {
  log.debug("Initializing the UI");
  $('#publishAudioChckbx').change(ADLT.onPublishAudioChanged);
  $('#publishVideoChckbx').change(ADLT.onPublishVideoChanged);
  log.debug("UI initialized");
};

ADLT.onPlatformReady = function () {
  log.debug("AddLive SDK ready");
  ADLT.populateDevicesQuick();
  ADLT.startLocalVideo();
  ADLT.initServiceListener();
};

/**
 * ==========================================================================
 * Beginning of the AddLive service events handling code
 * ==========================================================================
 */


ADLT.initServiceListener = function () {
  log.debug("Initializing the AddLive Service Listener");

//  1. Instantiate the listener
  var listener = new ADL.AddLiveServiceListener();


//  2. Define the handler for the user event
  listener.onUserEvent = function (e) {
    log.debug("Got new user event: " + e.userId);
    if (e.isConnected) {
      ADLT.onUserJoined(e);
    } else {
      log.debug("User with id: " + e.userId + ' left the media scope');
      $('#renderingWidget' + e.userId).html('').remove();
    }
  };

//  3. Define the handler for streaming status changed event
  listener.onMediaStreamEvent = function (e) {
    log.debug("Got new media streaming status changed event");
    switch (e.mediaType) {
      case ADL.MediaType.AUDIO:
        ADLT.onRemoteAudioStreamStatusChanged(e);
        break;
      case ADL.MediaType.VIDEO:
        ADLT.onRemoteVideoStreamStatusChanged(e);
        break;
      default :
        log.warn('Got unsupported media type in media stream event: ' +
            e.mediaType);
    }
  };

//  4. Define the handler for the media connection type changed event
  listener.onMediaConnTypeChanged = function (e) {
    log.debug("Got new media connection type: " + e.connectionType);
    $('#connTypeLbl').html(ADLT.mediaConnType2Label[e.connectionType]);
  };

//  5. Define the handler for the connection lost event
  listener.onConnectionLost = function (e) {
    log.warn('Got connection lost notification');
    ADLT.disconnectHandler();
    if (e.errCode == ADL.ErrorCodes.Communication.COMM_REMOTE_END_DIED) {
      log.warn('Connection terminated due to internet connection issues. ' +
          'Trying to reconnect in 5 seconds');
      ADLT.tryReconnect();
    }
  };

//  6. Prepare the success handler
  var onSucc = function () {
    log.debug("AddLive service listener registered");
    $('#connectBtn').click(ADLT.connect).removeClass('disabled');
  };

//  7. Finally register the AddLive Service Listener
  ADL.getService().addServiceListener(ADL.createResponder(onSucc), listener);

};

ADLT.onUserJoined = function (e) {
  log.debug("Got new user with id: " + e.userId);

//  1. Prepare a rendering widget for the user.
  var renderer = $('#rendererTmpl').clone();
  renderer.attr('id', 'renderingWidget' + e.userId);
  renderer.find('.render-wrapper').attr('id', 'renderer' + e.userId);
  renderer.find('.user-id-wrapper').html(e.userId);

//  2. Append it to the rendering area.
  $('#renderingWrapper').append(renderer);
  if (e.videoPublished) {
//    3a. Render the sink if the video stream is being published.
    ADL.renderSink({
      sinkId:e.videoSinkId,
      containerId:'renderer' + e.userId
    });
  } else {
//    3b. Just show the no video stream published indicator.
    renderer.find('.no-video-text').show();
  }

//  4. Show the "audio muted" indicator if user does not publish audio stream
  if (!e.audioPublished) {
    renderer.find('.muted-indicator').show();
  }

};

ADLT.onRemoteVideoStreamStatusChanged = function (e) {
  log.debug("Got change in video streaming for user with id: " + e.userId +
      ' user just ' +
      (e.videoPublished ? 'published' : 'stopped publishing') +
      ' the stream');
//  1. Grab the rendering widget corresponding to the user
  var renderingWidget = $('#renderingWidget' + e.userId);

  if (e.videoPublished) {
//    2a. If video was just published - render it and hide the
//        "No video from user" indicator
    ADL.renderSink({
      sinkId:e.videoSinkId,
      containerId:'renderer' + e.userId
    });
    renderingWidget.find('.no-video-text').hide();
  } else {
//    2b. If video was just unpublished - clear the renderer and show the
//        "No video from user" indicator
    renderingWidget.find('.render-wrapper').empty();
    renderingWidget.find('.no-video-text').show();
  }
};

ADLT.onRemoteAudioStreamStatusChanged = function (e) {
  log.debug("Got change in audio streaming for user with id: " + e.userId +
      ' user just ' +
      (e.audioPublished ? 'published' : 'stopped publishing') +
      ' the stream');

//  1. Find the "Audio is muted" indicator corresponding to the user
  var muteIndicator = $('#renderingWidget' + e.userId).
      find('.muted-indicator');
  if (e.audioPublished) {
//    2a. Hide it if audio stream was just published
    muteIndicator.hide();
  } else {
//    2.b Show it if audio was just unpublished
    muteIndicator.show();
  }
};

/**
 * Tries to reestablish the connection to the AddLive Streaming Server in case
 * of network-driven loss.
 *
 * It will retry the connect every 5 seconds.
 */
ADLT.tryReconnect = function () {

//  Register the reconnect handler to be triggered after 5 seconds
  setTimeout(function () {
    log.debug("Trying to reestablish the connection to the AddLive Streaming " +
        "Server");
	var connDescriptor = ADLT.genConnectionDescriptor();

//    1. Define the result handler
    var succHandler = function () {
      log.debug("Connection successfully reestablished!");
      ADLT.postConnectHandler(connDescriptor);
    };

//    2. Define the failure handler
    var errHandler = function () {
      log.warn("Failed to reconnect. Will try again in 5 secs");
      ADLT.tryReconnect();
    };
//    3. Try to connect
    ADL.getService().connect(ADL.createResponder(succHandler, errHandler),
        connDescriptor);
  }, 5000);

};

/**
 * ==========================================================================
 * End of the AddLive service events handling code
 * ==========================================================================
 */


ADLT.startLocalVideo = function () {
  log.debug("Starting local preview of current user");
//  1. Define the result handler
  var resultHandler = function (sinkId) {
    log.debug("Local preview started. Rendering the sink with id: " + sinkId);
    ADL.renderSink({
      sinkId:sinkId,
      containerId:'renderLocalPreview',
      mirror:true
    });
  };

//  2. Request the SDK to start capturing local user's preview
  ADL.getService().startLocalVideo(ADL.createResponder(resultHandler));
};

/**
 * ==========================================================================
 * Beginning of the connection management code
 * ==========================================================================
 */

ADLT.connect = function () {
  log.debug("Establishing a connection to the AddLive Streaming Server");

//  1. Disable the connect button to avoid a cascade of connect requests
  $('#connectBtn').unbind('click').addClass('disabled');

//  2. Get the scope id and generate the user id.
  ADLT.scopeId = $('#scopeIdTxtField').val();
  ADLT.userId = ADLT.genRandomUserId();

//  3. Define the result handler - delegates the processing to the
//     postConnectHandler
  var connDescriptor = ADLT.genConnectionDescriptor(ADLT.scopeId, ADLT.userId);

  var onSucc = function () {
	log.debug("Successfully established a connection to the AddLive Streaming Server");
	
    ADLT.postConnectHandler(connDescriptor);
  };

//  4. Define the error handler - enabled the connect button again
  var onErr = function () {
	log.debug("Unsuccessfully established a connection to the AddLive Streaming Server");
	
    $('#connectBtn').click(ADLT.connect).removeClass('disabled');
  };

//  5. Request the SDK to establish a connection
  ADL.getService().connect(ADL.createResponder(onSucc, onErr), connDescriptor);
};

ADLT.disconnect = function () {
  log.debug("Terminating a connection to the AddLive Streaming Server");

//  1. Define the result handler
  function succHandler() {
    ADLT.scopeId = undefined;
    ADLT.userId = undefined;
    ADLT.disconnectHandler();
  }

//  2. Request the SDK to terminate the connection
  ADL.getService().disconnect(ADL.createResponder(succHandler),
      ADLT.scopeId);
};

/**
 * Common post disconnect handler - used when user explicitly terminates the
 * connection or if the connection gets terminated due to the networking issues.
 *
 * It just resets the UI to the default state.
 */
ADLT.disconnectHandler = function () {

//  1. Toggle the active state of the Connect/Disconnect buttons
  $('#connectBtn').click(ADLT.connect).removeClass('disabled');
  $('#disconnectBtn').unbind('click').addClass('disabled');

//  2. Reset the connection type label
  $('#connTypeLbl').html('none');

//  3. Clear the remote user renderers
  $('#renderingWrapper').find('.remote-renderer').html('').remove();

//  4. Clear the local user id label
  $('#localUserIdLbl').html('undefined');
};

/**
 * Common post connect handler - used when user manually establishes the
 * connection or connection is being reestablished after being lost due to the
 * Internet connectivity issues.
 *
 */
ADLT.postConnectHandler = function (connDescriptor) {
  log.debug("Connected. Disabling connect button and enabling the disconnect");

//  1. Enable the disconnect button
  $('#disconnectBtn').click(ADLT.disconnect).removeClass('disabled');

//  2. Update the local user id label
  $('#localUserIdLbl').html(connDescriptor.authDetails.userId);

};

ADLT.genAuthDetails = function (scopeId, userId) {

  // New Auth API
  var dateNow = new Date();
  var now = Math.floor((dateNow.getTime() / 1000));
  var authDetails = {
    // Token valid 5 mins
    expires:now + (5 * 60),
    userId:userId,
    salt:ADLT.randomString(100)
  };
  var signatureBody =
      ADLT.APPLICATION_ID +
          scopeId +
          userId +
          authDetails.salt +
          authDetails.expires +
          ADLT.APP_SHARED_SECRET;
  authDetails.signature =
      CryptoJS.SHA256(signatureBody).toString(CryptoJS.enc.Hex).toUpperCase();
  return authDetails;
};


ADLT.genConnectionDescriptor = function (scopeId, userId) {
//  Clone the video streaming configuration and create a connection descriptor
//  using settings provided by the user
  var connDescriptor = $.extend({}, ADLT.CONNECTION_CONFIGURATION);
  connDescriptor.scopeId = scopeId;
  connDescriptor.authDetails = ADLT.genAuthDetails(scopeId, userId);
  connDescriptor.autopublishAudio = $('#publishAudioChckbx').is(':checked');
  connDescriptor.autopublishVideo = $('#publishVideoChckbx').is(':checked');
  return connDescriptor;
};


/**
 * ==========================================================================
 * End of the connection management code
 * ==========================================================================
 */

/**
 * ==========================================================================
 * Beginning of the user's events handling code
 * ==========================================================================
 */

/**
 * Handles the change of the "Publish Audio" checkbox
 */
ADLT.onPublishAudioChanged = function () {
  if (!ADLT.scopeId) {
//    If the scope id is not defined, it means that we're not connected and thus
//    there is nothing to do here.
    return;
  }

//  Since we're connected we need to either start or stop publishing the audio
// stream, depending on the new state of the checkbox
  if ($(this).is(':checked')) {
    ADL.getService().publish(ADL.createResponder(), ADLT.scopeId,
        ADL.MediaType.AUDIO);
  } else {
    ADL.getService().unpublish(ADL.createResponder(), ADLT.scopeId,
        ADL.MediaType.AUDIO);
  }

};
ADLT.onPublishVideoChanged = function () {
  if (!ADLT.scopeId) {

//    If the scope id is not defined, it means that we're not connected and thus
//    there is nothing to do here.
    return;
  }

//  Since we're connected we need to either start or stop publishing the audio
// stream, depending on the new state of the checkbox
  if ($(this).is(':checked')) {
    ADL.getService().publish(ADL.createResponder(), ADLT.scopeId,
        ADL.MediaType.VIDEO);
  } else {
    ADL.getService().unpublish(ADL.createResponder(), ADLT.scopeId,
        ADL.MediaType.VIDEO);
  }

};

ADLT.genAuthDetails = function (scopeId, userId) {

  // New Auth API
  var dateNow = new Date();
  var now = Math.floor((dateNow.getTime() / 1000));
  var authDetails = {
    // Token valid 5 mins
    expires:now + (5 * 60),
    userId:userId,
    salt:ADLT.randomString(100)
  };
  var signatureBody =
      ADLT.APPLICATION_ID +
          scopeId +
          userId +
          authDetails.salt +
          authDetails.expires +
          ADLT.APP_SHARED_SECRET;
  authDetails.signature =
      CryptoJS.SHA256(signatureBody).toString(CryptoJS.enc.Hex).toUpperCase();
  return authDetails;
};

/**
 * ==========================================================================
 * End of the user's events handling code
 * ==========================================================================
 */


/**
 * Register the document ready handler.
 */
$(ADLT.onDomReady);
