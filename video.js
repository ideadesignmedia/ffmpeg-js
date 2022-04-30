var fs = require('fs')
	, path = require('path'),
	jimp = require('jimp');
	let folder = path.join(process.cwd(), '.ffmpeg')
if (!fs.existsSync(folder)) fs.mkdirSync(folder)
let imageSize = async path => {
	if (!fs.existsSync(path)) return null
	return await jimp.read(path).then(img => ({ width: img.bitmap.width, height: img.bitmap.height })).catch(e => {
		throw e
	})
}
var errors = require('./errors')
	, presets = require('./presets')
	, utils = require('./utils');

module.exports = function (filePath, settings, infoConfiguration, infoFile) {

	this.file_path = `"${filePath}"`;
	this.info_configuration = infoConfiguration;
	this.metadata = infoFile;

	var commands = new Array()
		, inputs = new Array()
		, filtersComlpex = new Array(),
		cFilters = new Array(),
		beforeOutput = new Array()
		, output = null;

	var options = new Object();

	this.addCommand = function (command, argument, bO) {
		if (bO) return beforeOutput.push(command, argument)
		if (utils.in_array(command, commands) === false) {
			commands.push(command);
			if (argument != undefined)
				commands.push(argument);
		} else
			throw errors.renderError('command_already_exists', command);
	}

	this.addInput = function (argument) {
		inputs.push(`"${argument}"`);
	}


	this.addFilterComplex = function (argument, first, standalone) {
		if (standalone) {
			if (first) {
				cFilters.unshift(argument)
			} else {
				cFilters.push(argument)
			}
		} else if (first) {
			filtersComlpex.unshift(argument)
		} else {
			filtersComlpex.push(argument);
		}
	}

	var setOutput = function (path) {
		output = `"${path}"`;
	}


	this.setDisableAudio = function () {
		if (options.audio == undefined)
			options.audio = new Object();
		options.audio.disabled = true;
		return this;
	}

	this.setDisableVideo = function () {
		if (options.video == undefined)
			options.video = new Object();
		options.video.disabled = true;
		return this;
	}

	this.setVideoFormat = function (format) {
		if (this.info_configuration.encode.indexOf(format) != -1) {
			if (options.video == undefined)
				options.video = new Object();
			options.video.format = format;
			return this;
		} else
			throw errors.renderError('format_not_supported', format);
	}

	this.setVideoCodec = function (codec) {
		if (this.info_configuration.encode.indexOf(codec) != -1) {
			if (options.video == undefined)
				options.video = new Object();
			options.video.codec = codec;
			return this;
		} else
			throw errors.renderError('codec_not_supported', codec);
	}

	this.setVideoBitRate = function (bitrate) {
		if (options.video == undefined)
			options.video = new Object();
		options.video.bitrate = bitrate;
		return this;
	}

	this.setVideoFrameRate = function (framerate) {
		if (options.video == undefined)
			options.video = new Object();
		options.video.framerate = framerate;
		return this;
	}

	this.setVideoStartTime = function (time) {
		if (options.video == undefined)
			options.video = new Object();

		// Check if time is a string that contain: hours, minutes and seconds
		if (isNaN(time) && /([0-9]+):([0-9]{2}):([0-9]{2})/.exec(time)) {
			time = utils.durationToSeconds(time);
		} else if (!isNaN(time) && parseInt(time) == time) {
			time = parseInt(time, 10);
		} else {
			time = 0;
		}
		options.video.startTime = time;
		return this;
	}

	this.setVideoDuration = function (duration) {
		if (options.video == undefined)
			options.video = new Object();

		// Check if duration is a string that contain: hours, minutes and seconds
		if (isNaN(duration) && /([0-9]+):([0-9]{2}):([0-9]{2})/.exec(duration)) {
			duration = utils.durationToSeconds(duration);
		} else if (!isNaN(duration) && parseInt(duration) == duration) {
			duration = parseInt(duration, 10);
		} else {
			duration = 0;
		}
		options.video.duration = duration;
		return this;
	}

	this.setVideoAspectRatio = function (aspect) {
		// Check if aspect is a string
		if (isNaN(aspect)) {
			// Check if aspet is string xx:xx
			if (/([0-9]+):([0-9]+)/.exec(aspect)) {
				var check = /([0-9]+):([0-9]+)/.exec(aspect);
				aspect = parseFloat((check[1] / check[2]));
			} else {
				aspect = this.metadata.video.aspect.value;
			}
		}

		if (options.video == undefined)
			options.video = new Object();
		options.video.aspect = aspect;
		return this;
	}

	this.setVideoSize = function (size, keepPixelAspectRatio, keepAspectRatio, paddingColor) {
		if (options.video == undefined)
			options.video = new Object();
		options.video.size = size;
		options.video.keepPixelAspectRatio = keepPixelAspectRatio;
		options.video.keepAspectRatio = keepAspectRatio;
		options.video.paddingColor = paddingColor;
		return this;
	}

	this.setAudioCodec = function (codec) {
		if (this.info_configuration.encode.indexOf(codec) != -1) {
			// Check if codec is equal 'MP3' and check if the version of ffmpeg support the libmp3lame function
			if (codec == 'mp3' && this.info_configuration.modules.indexOf('libmp3lame') != -1)
				codec = 'libmp3lame';
			if (options.audio == undefined)
				options.audio = new Object();
			options.audio.codec = codec;
			return this;
		} else
			throw errors.renderError('codec_not_supported', codec);
	}

	this.setAudioFrequency = function (frequency) {
		if (options.audio == undefined)
			options.audio = new Object();
		options.audio.frequency = frequency;
		return this;
	}

	this.setAudioChannels = function (channel) {
		if (presets.audio_channel.stereo == channel || presets.audio_channel.mono == channel) {
			if (options.audio == undefined)
				options.audio = new Object();
			options.audio.channel = channel;
			return this;
		} else
			throw errors.renderError('audio_channel_is_invalid', channel);
	}

	this.setAudioBitRate = function (bitrate) {
		if (options.audio == undefined)
			options.audio = new Object();
		options.audio.bitrate = bitrate;
		return this;
	}

	this.setAudioQuality = function (quality) {
		if (options.audio == undefined)
			options.audio = new Object();
		options.audio.quality = quality;
		return this;
	}

	this.setWatermark = function (watermarkPath, settings) {
		var baseSettings = {
			position: "SW"		// Position: NE NC NW SE SC SW C CE CW
			, margin_nord: null		// Margin nord
			, margin_sud: null		// Margin sud
			, margin_east: null		// Margin east
			, margin_west: null		// Margin west
		};

		if (!fs.existsSync(watermarkPath))
			throw errors.renderError('invalid_watermark', watermarkPath);
		if (settings != null)
			utils.mergeObject(baseSettings, settings);
		if (baseSettings.position == null || utils.in_array(baseSettings.position, ['NE', 'NC', 'NW', 'SE', 'SC', 'SW', 'C', 'CE', 'CW']) === false)
			throw errors.renderError('invalid_watermark_position', baseSettings.position);
		if (baseSettings.margin_nord == null || isNaN(baseSettings.margin_nord))
			baseSettings.margin_nord = 0;
		if (baseSettings.margin_sud == null || isNaN(baseSettings.margin_sud))
			baseSettings.margin_sud = 0;
		if (baseSettings.margin_east == null || isNaN(baseSettings.margin_east))
			baseSettings.margin_east = 0;
		if (baseSettings.margin_west == null || isNaN(baseSettings.margin_west))
			baseSettings.margin_west = 0;
		var overlay = '';
		var getSing = function (val, inverse) {
			return (val > 0 ? (inverse ? '-' : '+') : (inverse ? '+' : '-')).toString() + Math.abs(val).toString();
		}
		var getHorizontalMargins = function (east, west) {
			return getSing(east, false).toString() + getSing(west, true).toString();
		}
		var getVerticalMargins = function (nord, sud) {
			return getSing(nord, false).toString() + getSing(sud, true).toString();
		}
		switch (baseSettings.position) {
			case 'NE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'NC':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'NW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SC':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'CE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'C':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'CW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
		}

		if (arguments[2] == undefined || arguments[2] == null) {
			if (options.video == undefined)
				options.video = new Object();
			options.video.watermark = { path: watermarkPath, overlay: overlay };
			return this;
		} else if (arguments[2] != undefined && arguments[2] === true) {
			this.addInput(watermarkPath);
			this.addFilterComplex('overlay=' + overlay);
		}
	}

	this.save = function (destionationFileName, opts, callback) {
		return new Promise(async (res, rej) => {
			if (options.hasOwnProperty('video')) {
				if (options.video.hasOwnProperty('disabled')) {
					this.addCommand('-vn');
				} else {
					if (opts.floorSize) this.addCommand('-vf', `"pad=ceil(iw/2)*2:ceil(ih/2)*2"`)
					if (options.video.hasOwnProperty('format'))
						this.addCommand('-f', options.video.format);
					if (options.video.hasOwnProperty('codec'))
						this.addCommand('-vcodec', options.video.codec);
					if (options.video.hasOwnProperty('bitrate'))
						this.addCommand('-b:v', parseInt(options.video.bitrate, 10) + 'k');
					if (options.video.hasOwnProperty('framerate'))
						this.addCommand('-r', parseInt(options.video.framerate, 10));
					if (options.video.hasOwnProperty('startTime'))
						this.addCommand('-ss', parseInt(options.video.startTime, 10));
					if (options.video.hasOwnProperty('duration'))
						this.addCommand('-t', parseInt(options.video.duration, 10));

					if (options.video.hasOwnProperty('watermark')) {
						this.addInput(options.video.watermark.path);
						this.addFilterComplex('[0][wm]overlay=' + options.video.watermark.overlay, false, true);
						let gScale = async () => {
							let size = await imageSize(options.video.watermark.path)
							let { width, height } = size
							let vW = this.metadata.video.resolutionSquare.w
							let vH = this.metadata.video.resolutionSquare.h
							if (vW < width || vH < height) {
								let aspect = width/height
								let yS = Math.round(vH-(vH*.03))
								let xS = Math.round(yS*aspect)
								if (xS > vW) {
									xS = Math.round(vW-(vW*.03))
									yS = Math.round(xS/aspect)
								}
								return {xS, yS}
							} else {
								return {xS: width, xY: height}
							}
						}
						let scale = await gScale()
						let {xS, yS} = scale
						this.addFilterComplex(`[1]scale=w=${xS}:h=${yS}[wm]`, true, true)
					}
					if (options.video.hasOwnProperty('size')) {
						var newDimension = _calculateNewDimension.call(this);

						if (newDimension.aspect != null) {
							this.addFilterComplex('scale=iw*sar:ih, pad=max(iw\\,ih*(' + newDimension.aspect.x + '/' + newDimension.aspect.y + ')):ow/(' + newDimension.aspect.x + '/' + newDimension.aspect.y + '):(ow-iw)/2:(oh-ih)/2' + (options.video.paddingColor != null ? ':' + options.video.paddingColor : ''));
							this.addCommand('-aspect', newDimension.aspect.string);
						}

						this.addCommand('-s', newDimension.width + 'x' + newDimension.height);
					}
				}
			}
			if (options.hasOwnProperty('audio')) {
				if (options.audio.hasOwnProperty('disabled')) {
					this.addCommand('-an');
				} else {
					if (options.audio.hasOwnProperty('codec'))
						this.addCommand('-acodec', options.audio.codec);
					if (options.audio.hasOwnProperty('frequency'))
						this.addCommand('-ar', parseInt(options.audio.frequency));
					if (options.audio.hasOwnProperty('channel'))
						this.addCommand('-ac', options.audio.channel);
					if (options.audio.hasOwnProperty('quality'))
						this.addCommand('-aq', options.audio.quality);
					if (options.audio.hasOwnProperty('bitrate'))
						this.addCommand('-b:a', parseInt(options.audio.bitrate, 10) + 'k');
				}
			}

			if (opts) {
				if (opts.downsample) {
					this.addFilterComplex('[0:a]amerge=inputs=1[a]')
					this.addCommand('-ac', '2', true)
					this.addCommand('-map', '0:v', true)
					this.addCommand('-map', '[a]', true)
				}
			}
			setOutput(destionationFileName);
			if (fs.existsSync(destionationFileName)) {
				if (!opts.force) return rej('Output file already exists')
				fs.unlinkSync(destionationFileName)
			}
			execCommand().then(u => { res(u) }).catch(e => {
				rej(e)
			});
		})
	}


	var resetCommands = function (self) {
		commands = new Array()
		inputs = [self.file_path];
		filtersComlpex = new Array();
		output = null;
		options = new Object();
	}

	var _calculateNewDimension = function () {
		var keepPixelAspectRatio = typeof options.video.keepPixelAspectRatio != 'boolean' ? false : options.video.keepPixelAspectRatio;
		var keepAspectRatio = typeof options.video.keepAspectRatio != 'boolean' ? false : options.video.keepAspectRatio;
		var referrerResolution = this.metadata.video.resolution;
		if (keepPixelAspectRatio) {
			if (utils.isEmptyObj(this.metadata.video.resolutionSquare))
				throw errors.renderError('resolution_square_not_defined');
			referrerResolution = this.metadata.video.resolutionSquare;
		}
		var width = null
			, height = null
			, aspect = null;
		var fixedWidth = /([0-9]+)x\?/.exec(options.video.size)
			, fixedHeight = /\?x([0-9]+)/.exec(options.video.size)
			, percentage = /([0-9]{1,2})%/.exec(options.video.size)
			, classicSize = /([0-9]+)x([0-9]+)/.exec(options.video.size);

		if (fixedWidth) {
			width = parseInt(fixedWidth[1], 10);
			if (!utils.isEmptyObj(this.metadata.video.aspect)) {
				height = Math.round((width / this.metadata.video.aspect.x) * this.metadata.video.aspect.y);
			} else {
				height = Math.round(referrerResolution.h / (referrerResolution.w / parseInt(fixedWidth[1], 10)));
			}
		} else if (fixedHeight) {
			height = parseInt(fixedHeight[1], 10);
			if (!utils.isEmptyObj(this.metadata.video.aspect)) {
				width = Math.round((height / this.metadata.video.aspect.y) * this.metadata.video.aspect.x);
			} else {
				width = Math.round(referrerResolution.w / (referrerResolution.h / parseInt(fixedHeight[1], 10)));
			}
		} else if (percentage) {
			var ratio = parseInt(percentage[1], 10) / 100;
			width = Math.round(referrerResolution.w * ratio);
			height = Math.round(referrerResolution.h * ratio);
		} else if (classicSize) {
			width = parseInt(classicSize[1], 10);
			height = parseInt(classicSize[2], 10);
		} else
			throw errors.renderError('size_format', options.video.size);
		if (width % 2 != 0) width -= 1;
		if (height % 2 != 0) height -= 1;

		if (keepAspectRatio) {
			var gcdValue = utils.gcd(width, height);
			aspect = new Object();
			aspect.x = width / gcdValue;
			aspect.y = height / gcdValue;
			aspect.string = aspect.x + ':' + aspect.y;
		}

		return { width: width, height: height, aspect: aspect };
	}

	var execCommand = function (callback, folder) {
		return new Promise((resolve, reject) => {
			var onlyDestinationFile = folder != undefined ? false : true;
			var finalCommands = ['-i']
				.concat(inputs.join(' -i '))
				.concat(commands.join(' '))
				.concat(filtersComlpex.length > 0 || cFilters.length > 0 ? (() => {
					let a = []
					let b = cFilters.length > 0 ? a.concat(cFilters.map(u => u+';').join(' ')) : a
					let c = filtersComlpex.length > 0 ? b.concat(filtersComlpex.join(', ')) : b
					let d = c.join(' ')
					let f = /(,|;)$/.test(d) ? d.split('').splice(0, d.length - 1).join('') : d
					return '-filter_complex "' + f + '"'
				})() : [])
				.concat(beforeOutput.join(' '))
				.concat([output]);
			resetCommands(this);
			utils.exec(finalCommands, settings).then(() => {
				var result = null;
				if (onlyDestinationFile) {
					result = finalCommands[finalCommands.length - 1];
				} else {
					if (folder.charAt(folder.length - 1) == "/")
						folder = folder.substr(0, folder.length - 1);
					result = fs.readdirSync(folder);
					for (var i in result)
						result[i] = [folder, result[i]].join('/')
				}
				resolve(result);
			}).catch(e => reject(e))
		})
	}

	this.fnExtractSoundToMP3 = function (destionationFileName, callback) {
		if (fs.existsSync(destionationFileName))
			fs.unlinkSync(destionationFileName);

		var destinationDirName = path.dirname(destionationFileName)
			, destinationFileNameWE = path.basename(destionationFileName, path.extname(destionationFileName)) + '.mp3'
			, finalPath = path.join(destinationDirName, destinationFileNameWE);

		resetCommands(this);

		this.addCommand('-vn');
		this.addCommand('-ar', 44100);
		this.addCommand('-ac', 2);
		this.addCommand('-ab', 192);
		this.addCommand('-f', 'mp3');

		setOutput(finalPath);

		execCommand().then(u => { if (typeof callback === 'function') callback(u) }).catch(e => {
			throw e
		});
	}

	this.fnExtractFrameToJPG = function (/* destinationFolder, settings, callback */) {

		var destinationFolder = null
			, newSettings = null
			, callback = null;

		var settings = {
			start_time: null		// Start time to recording
			, duration_time: null		// Duration of recording
			, frame_rate: null		// Number of the frames to capture in one second
			, size: null		// Dimension each frame
			, number: null		// Total frame to capture
			, every_n_frames: null		// Frame to capture every N frames
			, every_n_seconds: null		// Frame to capture every N seconds
			, every_n_percentage: null		// Frame to capture every N percentage range
			, keep_pixel_aspect_ratio: true		// Mantain the original pixel video aspect ratio
			, keep_aspect_ratio: true		// Mantain the original aspect ratio
			, padding_color: 'black'	// Padding color
			, file_name: null		// File name
		};

		for (var i in arguments) {
			switch (typeof arguments[i]) {
				case 'string':
					destinationFolder = arguments[i];
					break;
				case 'object':
					newSettings = arguments[i];
					break;
				case 'function':
					callback = arguments[i];
					break;
			}
		}

		if (newSettings !== null)
			utils.mergeObject(settings, newSettings);

		// Check if 'start_time' is in the format hours:minutes:seconds
		if (settings.start_time != null) {
			if (/([0-9]+):([0-9]{2}):([0-9]{2})/.exec(settings.start_time))
				settings.start_time = utils.durationToSeconds(settings.start_time);
			else if (!isNaN(settings.start_time))
				settings.start_time = parseInt(settings.start_time, 10);
			else
				settings.start_time = null;
		}

		// Check if 'duration_time' is in the format hours:minutes:seconds
		if (settings.duration_time != null) {
			if (/([0-9]+):([0-9]{2}):([0-9]{2})/.exec(settings.duration_time))
				settings.duration_time = utils.durationToSeconds(settings.duration_time);
			else if (!isNaN(settings.duration_time))
				settings.duration_time = parseInt(settings.duration_time, 10);
			else
				settings.duration_time = null;
		}

		// Check if the value of the framerate is number type
		if (settings.frame_rate != null && isNaN(settings.frame_rate))
			settings.frame_rate = null;

		// If the size is not settings then the size of the screenshots is equal to video size
		if (settings.size == null)
			settings.size = this.metadata.video.resolution.w + 'x' + this.metadata.video.resolution.h;

		// Check if the value of the 'number frame to capture' is number type
		if (settings.number != null && isNaN(settings.number))
			settings.number = null;

		var every_n_check = 0;

		// Check if the value of the 'every_n_frames' is number type
		if (settings.every_n_frames != null && isNaN(settings.every_n_frames)) {
			settings.every_n_frames = null;
			every_n_check++;
		}

		// Check if the value of the 'every_n_seconds' is number type
		if (settings.every_n_seconds != null && isNaN(settings.every_n_seconds)) {
			settings.every_n_seconds = null;
			every_n_check++;
		}

		// Check if the value of the 'every_n_percentage' is number type
		if (settings.every_n_percentage != null && (isNaN(settings.every_n_percentage) || settings.every_n_percentage > 100)) {
			settings.every_n_percentage = null;
			every_n_check++;
		}

		if (every_n_check >= 2) {
			if (callback) {
				callback(errors.renderError('extract_frame_invalid_everyN_options'));
			} else {
				throw errors.renderError('extract_frame_invalid_everyN_options');
			}
		}
		if (settings.file_name == null) {
			settings.file_name = path.basename(this.file_path, path.extname(this.file_path));
		} else {
			var replacements = settings.file_name.match(/(\%[a-zA-Z]{1})/g);
			if (replacements) {
				for (var i in replacements) {
					switch (replacements[i]) {
						case '%t':
							settings.file_name = settings.file_name.replace('%t', new Date().getTime());
							break;
						case '%s':
							settings.file_name = settings.file_name.replace('%s', settings.size);
							break;
						case '%x':
							settings.file_name = settings.file_name.replace('%x', settings.size.split(':')[0]);
							break;
						case '%y':
							settings.file_name = settings.file_name.replace('%y', settings.size.split(':')[1]);
							break;
						default:
							settings.file_name = settings.file_name.replace(replacements[i], '');
							break;
					}
				}
			}
		}
		settings.file_name = path.basename(settings.file_name, path.extname(settings.file_name)) + '_%d.jpg';
		utils.mkdir(destinationFolder, 0777);
		resetCommands(this);
		if (settings.startTime)
			this.addCommand('-ss', settings.startTime);
		if (settings.duration_time)
			this.addCommand('-t', settings.duration_time);
		if (settings.frame_rate)
			this.addCommand('-r', settings.frame_rate);
		this.setVideoSize(settings.size, settings.keep_pixel_aspect_ratio, settings.keep_aspect_ratio, settings.padding_color);
		var newDimension = _calculateNewDimension.call(this);
		this.addCommand('-s', newDimension.width + 'x' + newDimension.height);
		if (newDimension.aspect != null) {
			this.addFilterComplex('scale=iw*sar:ih, pad=max(iw\\,ih*(' + newDimension.aspect.x + '/' + newDimension.aspect.y + ')):ow/(' + newDimension.aspect.x + '/' + newDimension.aspect.y + '):(ow-iw)/2:(oh-ih)/2' + (settings.padding_color != null ? ':' + settings.padding_color : ''));
			this.addCommand('-aspect', newDimension.aspect.string);
		}
		if (settings.number)
			this.addCommand('-vframes', settings.number);
		if (settings.every_n_frames) {
			this.addCommand('-vsync', 0);
			this.addFilterComplex('select=not(mod(n\\,' + settings.every_n_frames + '))');
		}
		if (settings.every_n_seconds) {
			this.addCommand('-vsync', 0);
			this.addFilterComplex('select=not(mod(t\\,' + settings.every_n_seconds + '))');
		}
		if (settings.every_n_percentage) {
			this.addCommand('-vsync', 0);
			this.addFilterComplex('select=not(mod(t\\,' + parseInt((this.metadata.duration.seconds / 100) * settings.every_n_percentage) + '))');
		}
		setOutput(path.join(destinationFolder, settings.file_name));
		execCommand(null, destinationFolder).then(u => { if (typeof callback === 'function') callback(u, destinationFolder) }).catch(e => {
			throw e
		});
	}

	this.fnAddWatermark = function (watermarkPath /* newFilepath , settings, callback */) {

		var newFilepath = null
			, newSettings = null
			, callback = null;

		for (var i = 1; i < arguments.length; i++) {
			switch (typeof arguments[i]) {
				case 'string':
					newFilepath = arguments[i];
					break;
				case 'object':
					newSettings = arguments[i];
					break;
				case 'function':
					callback = arguments[i];
					break;
			}
		}

		resetCommands(this);

		this.setWatermark(watermarkPath, newSettings, true);

		if (newFilepath == null)
			newFilepath = path.dirname(this.file_path) + '/' +
				path.basename(this.file_path, path.extname(this.file_path)) + '_watermark_' +
				path.basename(watermarkPath, path.extname(watermarkPath)) +
				path.extname(this.file_path);

		setOutput(`"${newFilepath}"`);

		execCommand().then(u => { if (typeof callback === 'function') callback(u) }).catch(e => {
			throw e
		});
	}

	var __constructor = function (self) {
		resetCommands(self);
	}(this);
}