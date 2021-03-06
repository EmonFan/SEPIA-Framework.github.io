//ACTIONS
function sepiaFW_build_ui_actions(){
	var Actions = {};

	//Simple delay queue that waits for next idle state - NOTE: don't mistake this for 'command queue' (client)
	//Executes all functions in next idle state so MAKE SURE! they don't interfere with each other!
	var delayQueue = {};
	var delayId = 0;
	Actions.delayFunctionUntilIdle = function(_fun, _idleState){
		delayId++;
		if (delayId > 64000) delayId = 0;
		if (!_idleState) _idleState = "any"; 		//could be: unknown, ttsFinished, dialogFinished, asrFinished, anyButAsr
		delayQueue[delayId] = {
			fun: _fun,
			idleState: _idleState,
			id: delayId
		};
	}
	Actions.executeDelayedFunctionsAndRemove = function(stateFilter){
		var cleanUpIds = [];
		$.each(delayQueue, function(i, queueData){
			//console.log("delayed call: " + JSON.stringify(queueData)); 		//DEBUG
			if (!stateFilter 
				|| queueData.idleState == "any" 
				|| (queueData.idleState == stateFilter)
				|| (queueData.idleState == "anyButAsr" && stateFilter != "asrFinished")){
				queueData.fun();
				cleanUpIds.push(queueData.id);
			}
		});
		for (var i=0; i<cleanUpIds.length; i++){
			delete delayQueue[cleanUpIds[i]];
		}
	}
	Actions.getDelayQueueSize = function(){
		//console.log('DelayQueue size: ' + delayQueue.length); 		//DEBUG
		return Object.keys(delayQueue).length;
	}
	Actions.clearDelayQueue = function(){
		delayQueue = {};
	}
	
	//note: 'action' is 'actionInfo[i]'
	
	//BUTTON Help
	Actions.addButtonHelp = function(action, parentBlock){
		var urlBtn = document.createElement('BUTTON');
		urlBtn.className = 'chat-button-help';
		SepiaFW.ui.onclick(urlBtn, function(){
		//urlBtn.addEventListener("click", function(){ 
			var newAction = {};
			newAction.info = "direct_cmd";
			newAction.cmd = "chat;;type=help;;";
			newAction.options = { skipTTS : true, skipText : true, targetView : "bigResults" };
			Actions.openCMD(newAction);
		}, true);
		urlBtn.innerHTML = action.title || SepiaFW.local.g('help');
		parentBlock.appendChild(urlBtn);
	}
	
	//BUTTON TeachUI
	Actions.addButtonTeachUI = function(action, parentBlock){
		if (SepiaFW.teach){
			var teachBtn = document.createElement('BUTTON');
			teachBtn.className = 'chat-button-teach';
			var info = action.info;
			SepiaFW.ui.onclick(teachBtn, function(){
				SepiaFW.ui.closeAllMenus();
				SepiaFW.teach.openUI(info);
			}, true);
			teachBtn.innerHTML = action.title || SepiaFW.local.g('teach_ui_btn');
			parentBlock.appendChild(teachBtn);
		}
	}
	//BUTTON Frames-layer view
	Actions.addButtonFrameView = function(action, parentBlock){
		if (SepiaFW.frames){
			var framesBtn = document.createElement('BUTTON');
			framesBtn.className = 'chat-button-frames';
			var info = action.info;
			SepiaFW.ui.onclick(framesBtn, function(){
				SepiaFW.ui.closeAllMenus();
				SepiaFW.frames.open(info);
			}, true);
			framesBtn.innerHTML = action.title || info.frameName || SepiaFW.local.g('frames_view_btn');
			parentBlock.appendChild(framesBtn);
		}
	}
	
	//BUTTON Custom function
	Actions.addButtonCustomFunction = function(action, sender, parentBlock){
		var funBtn = document.createElement('BUTTON');
		funBtn.className = 'chat-button-custom-fun';
		if (sender) action.sender = sender;
		funBtn.setAttribute("data-sender", action.sender);
		SepiaFW.ui.onclick(funBtn, function(){
			action.fun(funBtn);
		}, true);
		funBtn.innerHTML = action.title;
		parentBlock.appendChild(funBtn);
	}
	
	//BUTTON URLs
	Actions.addButtonURL = function(action, parentBlock){
		var urlBtn = document.createElement('BUTTON');
		urlBtn.className = 'chat-button-url';
		urlBtn.setAttribute("data-url", action.url);
		SepiaFW.ui.onclick(urlBtn, function(){
		//urlBtn.addEventListener("click", function(){ 
			Actions.openURL(action);
		}, true);
		urlBtn.innerHTML = action.title;
		parentBlock.appendChild(urlBtn);
	}
	
	//OPEN URLs
	Actions.openURL = function(action, forceExternal){
		Actions.openUrlAutoTarget(action.url, forceExternal);
	}
	var inAppBrowserOptions = 'location=yes,toolbar=yes,mediaPlaybackRequiresUserAction=yes,allowInlineMediaPlayback=yes,hardwareback=yes,disableswipenavigation=no,clearsessioncache=no,clearcache=no';
	Actions.openUrlAutoTarget = function(url, forceExternal){
		if (SepiaFW.ui.isCordova){
			if (forceExternal 
				|| url.indexOf('https://maps.') === 0 || url.indexOf('http://maps.') === 0
				|| url.indexOf('https://www.google.com/maps/') === 0 || url.indexOf('https://www.google.de/maps/') === 0
				){
				cordova.InAppBrowser.open(url, '_system');
			}else{
				cordova.InAppBrowser.open(url, '_blank', inAppBrowserOptions);
			}
		}else{
			window.open(url, '_blank');
		}
	}
	
	//BUTTON CMDs
	Actions.addButtonCMD = function(action, sender, parentBlock){
		var cmdBtn = document.createElement('BUTTON');
		cmdBtn.className = 'chat-button-cmd';
		if (sender) action.sender = sender;
		cmdBtn.setAttribute("data-sender", action.sender);
		cmdBtn.setAttribute("data-cmd", action.cmd);
		SepiaFW.ui.onclick(cmdBtn, function(){
		//cmdBtn.addEventListener("click", function(){ 
			Actions.openCMD(action);
			SepiaFW.debug.info("Action - sending button-cmd: " + action.cmd); 
		}, true);
		cmdBtn.innerHTML = action.title;
		parentBlock.appendChild(cmdBtn);
	}
	
	//OPEN CMDs
	Actions.openCMD = function(action){
		if (SepiaFW.client){
			if (!action.options){
				action.options = {};
			}
			if (!action.options.targetView){
				//add default view
				action.options.targetView = "chat";
			}
			SepiaFW.client.sendCommand(action);	//handles options
		}else{
			SepiaFW.debug.info("Action: button type 'openCMD' is not supported yet.");
		}
	}
	
	//QUEUE CMDs - Note: these commands are executed in idle state with "openCMD" (so they have to support this)
	Actions.queueCMD = function(action){
		if (SepiaFW.client){
			SepiaFW.client.queueCommand(action);
		}else{
			SepiaFW.debug.info("Action: 'queueCMD' is not supported yet.");
		}
	}
	
	//HTML RESULT ACTION
	Actions.buildHtmlResultAction = function(action, parentBlock, handleOptions){
		if (SepiaFW.ui.cards){
			//build card from html data
			var card = SepiaFW.ui.cards.buildCustomHtmlCardFromAction(action);
			var resultView;
			
			//check options for target view
			if (handleOptions.targetView && parentBlock){
				//this has highest prio since the handler is waiting for data in parentBlock
				parentBlock.appendChild(card);
			}else if (action.options && action.options.targetView){
				//get right view
				resultView = SepiaFW.ui.getResultViewByName(action.options.targetView);
				SepiaFW.ui.addDataToResultView(resultView, card, false, true, 500);
			}else if (!parentBlock){
				//get default view
				resultView = SepiaFW.ui.getResultViewByName("chat");
				SepiaFW.ui.addDataToResultView(resultView, card, false, true, 500);
			}else{
				parentBlock.appendChild(card);
			}
		}else{
			SepiaFW.debug.info("Action: type 'show_html_result' is not supported yet.");
		}
	}
	
	//PLAY AUDIO STREAM
	Actions.playAudioURL = function(action, triggeredViaButton){
		if (SepiaFW.audio){
			if (SepiaFW.speech && (SepiaFW.speech.isSpeaking() || SepiaFW.speech.isWaitingForSpeech())){	//its starting to get messy here with all the exceptions, we need a proper event queue ...
				//do something to delay start?
			}
			if (!triggeredViaButton){
				var idleState = "anyButAsr";
				Actions.delayFunctionUntilIdle(function(){
					playAction(action);
				}, idleState);
			}else{
				playAction(action);
			}
		}else{
			SepiaFW.debug.info("Action: type 'play_audio_stream' is not supported yet.");
		}
	}
	function playAction(action){
		SepiaFW.audio.playerSetVolumeTemporary(1.0); 		//<-- to start smoothly
		SepiaFW.audio.setPlayerTitle(action.audio_title, '');
		SepiaFW.audio.playURL(action.audio_url, '', function(){
			SepiaFW.audio.playerFadeToOriginalVolume();
		});//, onEndCallback, onErrorCallback)
	}
	//STOP AUDIO STREAM
	Actions.stopAudio = function(action){
		if (SepiaFW.audio){
			SepiaFW.audio.stop();
			//SepiaFW.debug.info("Action: type 'stop_audio_stream'.");
		}else{
			SepiaFW.debug.info("Action: type 'stop_audio_stream' is not supported yet.");
		}
	}
	
	//SCHEDULE Messages
	Actions.scheduleMessage = function(action, parentBlock){
		//TODO: distinguish between proActive-background and other types of messages
		if (action.info && action.info === "entertainWhileIdle"){
			SepiaFW.events.setProActiveBackgroundNotification(action);
		}else{
			SepiaFW.debug.info("Action: type '" + action.type + "' with info '" + action.info + "' is not supported yet.");
		}
	}
	
	//TIMERs and ALARMs
	Actions.timerAndAlarm = function(action, parentBlock){
		//SET
		if (action.info === "set"){
			if (action.eleType === SepiaFW.events.TIMER){
				Actions.setTimer(action, parentBlock);
			}else if (action.eleType === SepiaFW.events.ALARM){
				Actions.setAlarm(action, parentBlock);
			}else{
				SepiaFW.debug.info("Action: type '" + action.type + "' with eleType '" + action.eleType + "' is not supported yet.");
			}
		//REMOVE
		}else if (action.info === "remove"){
			var Timer = SepiaFW.events.getRunningOrActivatedTimeEventById(action.eventId);
			if (Timer){
				//remove event
				SepiaFW.events.removeTimeEvent(Timer.name);
				//clear DOM?
				$timerElements = $(SepiaFW.ui.JQ_RES_VIEW_IDS).find('[data-id="' + Timer.data.eventId + '"]');
				$timerElements.closest('.sepiaFW-cards-flexSize-container.oneElement').remove();
				$timerElements.remove();
			}
			
		}else{
			SepiaFW.debug.info("Action: type '" + action.type + "' with info '" + action.info + "' is not supported yet.");
		}
	}
	//TIMER
	Actions.setTimer = function(action, parentBlock){
		setTimeEvent(SepiaFW.events.TIMER, action, parentBlock);
	}
	//ALARM
	Actions.setAlarm = function(action, parentBlock){
		setTimeEvent(SepiaFW.events.ALARM, action, parentBlock);
	}
	//... set method
	function setTimeEvent(eventType, action, parentBlock){
		var card;
		var timeEventEle;
		if (SepiaFW.ui.cards){
			card = SepiaFW.ui.cards.buildTimeEventElementFromAction(action, eventType);
			timeEventEle = $(card).find('.timeEvent')[0];
			
			if (parentBlock){
				if (parentBlock.id == 'sepiaFW-my-view'){
					$(parentBlock).prepend(card);
				}else{
					parentBlock.appendChild(card);
				}
			}else{
				SepiaFW.ui.insertEle("sepiaFW-chat-output", card);
				SepiaFW.ui.scrollToBottom("sepiaFW-chat-output");
			}
		}
		SepiaFW.events.addOrRefreshTimeEvent(action.targetTimeUnix, eventType, action);
	}
	
	//EVENTS START
	Actions.buildMyEventsBox = function(action, parentBlock){
		//fadeout old
		var	aButtonsAreaReplaced = document.getElementById('sepiaFW-myEvents-buttons');
		if (aButtonsAreaReplaced){
			aButtonsAreaReplaced.id = 'sepiaFW-myEvents-buttons-replaced';
			var oldEventsParent = $(aButtonsAreaReplaced).closest('.chatMsg');
			oldEventsParent.fadeOut(300, function(){
				oldEventsParent.remove();
			});
		}else{
			//first events
			$('#sepiaFW-my-view-intro').remove(); 		//remove welcome message
		}
		//make new
		var	aButtonsArea = document.createElement('DIV');
		aButtonsArea.id = 'sepiaFW-myEvents-buttons';
		aButtonsArea.className = 'chat-buttons-area';
		aButtonsArea.style.display = 'none';
		//header
		var titleNote = document.createElement('P');
		titleNote.className = 'sepiaFW-myEvents-titleNote';
		titleNote.innerHTML = SepiaFW.local.g('recommendationsFor') + " " + SepiaFW.account.getUserName() + ":";
		var dateNote = document.createElement('DIV');
		dateNote.className = 'sepiaFW-myEvents-dateHeader';
		dateNote.innerHTML = (new Date().toLocaleString());
		$(aButtonsArea).prepend(dateNote);
		$(aButtonsArea).prepend(titleNote);
		
		//show again on top
		$(parentBlock).append(aButtonsArea);
		$(aButtonsArea).fadeIn(500);
		
		return aButtonsArea;
	}
	
	//Build client-first-start box
	Actions.buildClientFirstStartBox = function(action, parentBlock){
		//fadeout old
		var	aButtonsAreaReplaced = document.getElementById('sepiaFW-myFirstStart-buttons');
		if (aButtonsAreaReplaced){
			aButtonsAreaReplaced.id = 'sepiaFW-myFirstStart-buttons-replaced';
			var oldFirstStartParent = $(aButtonsAreaReplaced).closest('.chatMsg');
			oldFirstStartParent.fadeOut(300, function(){
				oldFirstStartParent.remove();
			});
		}
		//make new
		var	aButtonsArea = document.createElement('DIV');
		aButtonsArea.id = 'sepiaFW-myFirstStart-buttons';
		aButtonsArea.className = 'chat-buttons-area';
		aButtonsArea.style.display = 'none';
		//header
		var titleNote = document.createElement('P');
		titleNote.className = 'sepiaFW-myFirstStart-titleNote';
		titleNote.innerHTML = SepiaFW.local.g('forNewcomers') + ":";
		$(aButtonsArea).prepend(titleNote);
		
		//show again on top
		$(parentBlock).append(aButtonsArea);
		$(aButtonsArea).fadeIn(500);
		
		return aButtonsArea;
	}
	
	//-----Handler-----
	Actions.handle = function(data, parentBlock, sender, handleOptions){
		if (data.actionInfo){
			//handle options
			if (!handleOptions) handleOptions = {};
			var doButtonsOnly = handleOptions.doButtonsOnly;
			
			//buttons will be collected here:
			var aButtonsArea = document.createElement('DIV');
			aButtonsArea.className = 'chat-buttons-area';
			parentBlock.appendChild(aButtonsArea); 	//we just assume its there and place it here before any other actions
			//iterate:
			for (var i = 0; i < data.actionInfo.length; i++) {
				var type = data.actionInfo[i].type;
				//run through everything except buttons (that does the UI build method)
				if (type){
					if (doButtonsOnly){
						if (!type.indexOf('button_') === 0){
							continue;
						}
					}
					//Events - if there are events this will be triggered first
					if (type === 'events_start'){
						//... check info?
						parentBlock.removeChild(aButtonsArea); 	//we will create a new one
						aButtonsArea = Actions.buildMyEventsBox(data.actionInfo[i], parentBlock);
						
					//First client visit info actions in my-view - if there are any this will be triggered first
					}else if (type === 'fist_visit_info_start'){
						parentBlock.removeChild(aButtonsArea); 	//we will create a new one
						aButtonsArea = Actions.buildClientFirstStartBox(data.actionInfo[i], parentBlock);

					//HTML result
					}else if (type === 'show_html_result'){
						Actions.buildHtmlResultAction(data.actionInfo[i], parentBlock, handleOptions);
					
					//BUTTON - help
					}else if (type === 'button_help'){
						Actions.addButtonHelp(data.actionInfo[i], aButtonsArea);
						
					//BUTTON - teach UI
					}else if (type === 'button_teach_ui'){
						Actions.addButtonTeachUI(data.actionInfo[i], aButtonsArea);
					
					//BUTTON - frames view
					}else if (type === 'button_frames_view'){
						Actions.addButtonFrameView(data.actionInfo[i], aButtonsArea);
					
					//BUTTON - url
					}else if (type === 'button_url' || type === 'button_in_app_browser'){
						Actions.addButtonURL(data.actionInfo[i], aButtonsArea);
						
					//BUTTON - cmd
					}else if (type === 'button_cmd'){
						Actions.addButtonCMD(data.actionInfo[i], sender, aButtonsArea);
						
					//BUTTON - custom function
					}else if (type === 'button_custom_fun'){	
						Actions.addButtonCustomFunction(data.actionInfo[i], sender, aButtonsArea);
						
					//Open URL
					}else if (type === 'open_in_app_browser'){
						Actions.openURL(data.actionInfo[i]);
					}else if (type === 'open_url'){
						Actions.openURL(data.actionInfo[i], true);
						
					//Queue CMD - Note: these commands are executed in idle state with "openCMD" (so they have to support this)
					}else if (type === 'queue_cmd'){
						Actions.queueCMD(data.actionInfo[i]);

					//Show dialog abort button
					}else if (type === 'show_abort'){
						var title = SepiaFW.local.g('abort');
						//var abortAction = SepiaFW.offline.getCmdButtonAction("abort", title, false);
						//Actions.addButtonCMD(abortAction, sender, aButtonsArea);
						var abortAction = SepiaFW.offline.getCustomFunctionButtonAction(function(btn){
							SepiaFW.ui.resetMicButton();
							$(btn).fadeOut(300, function(){ $(btn).remove(); });
						}, title);
						Actions.addButtonCustomFunction(abortAction, sender, aButtonsArea);
					
					//Audio stream
					}else if (type === 'play_audio_stream'){
						Actions.playAudioURL(data.actionInfo[i]);
					}else if (type === 'stop_audio_stream'){
						Actions.stopAudio(data.actionInfo[i]);
						
					//Schedule messages
					}else if (type === 'schedule_msg'){
						Actions.scheduleMessage(data.actionInfo[i], parentBlock);
					
					//Time events - TODO: type should be more general like "timeEvent"
					}else if (type === 'timer' || type === 'alarm' || type === 'timeEvent'){
						var actionInfo = data.actionInfo[i];
						if (actionInfo.eleType === SepiaFW.events.TIMER){
							Actions.timerAndAlarm(actionInfo, parentBlock);
						}else if (actionInfo.eleType === SepiaFW.events.ALARM){
							Actions.timerAndAlarm(actionInfo, parentBlock);
						}else if (actionInfo.info === "remove"){
							Actions.timerAndAlarm(actionInfo, parentBlock);
						}else{
							SepiaFW.debug.info('UNSUPPORTED ACTION (timeEvent): ' + JSON.stringify(actionInfo));
						}
					
					//UNKNOWN
					}else{
						SepiaFW.debug.info('UNSUPPORTED ACTION: ' + JSON.stringify(data.actionInfo[i]));
					}
				}
			}
			if (!aButtonsArea.innerHTML) parentBlock.removeChild(aButtonsArea);
		}
	}
	
	return Actions;
}