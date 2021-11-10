const path = require('path')
const fs = require('fs')
const https = require('https')
var errors = require('./errors')
	, utils = require('./utils')
	, configs = require('./configs')
	, video = require('./video')

var ffmpeg = function (/* inputFilepath, settings, callback */) {

	/**
	 * Retrieve the list of the codec supported by the ffmpeg software
	 */
	var _ffmpegInfoConfiguration = function (settings) {
		return new Promise((resolve, reject) => {

			var format = { modules: new Array(), encode: new Array(), decode: new Array() };
			// Make the call to retrieve information about the ffmpeg
			utils.exec(['-formats', '2>&1'], settings).then(stdout => {
				var configuration = /configuration:(.*)/.exec(stdout);
				// Check if exists the configuration
				if (configuration) {
					// Get the list of modules
					var modules = configuration[1].match(/--enable-([a-zA-Z0-9\-]+)/g);
					// Scan all modules
					for (var indexModule in modules) {
						// Add module to the list
						format.modules.push(/--enable-([a-zA-Z0-9\-]+)/.exec(modules[indexModule])[1]);
					}
				}
				// Get the codec list
				var codecList = stdout.match(/ (DE|D|E) (.*) {1,} (.*)/g);
				// Scan all codec
				for (var i in codecList) {
					// Get the match value
					var match = / (DE|D|E) (.*) {1,} (.*)/.exec(codecList[i]);
					// Check if match is valid
					if (match) {
						// Get the value from the match
						var scope = match[1].replace(/\s/g, '')
							, extension = match[2].replace(/\s/g, '');
						// Check which scope is best suited
						if (scope == 'D' || scope == 'DE')
							format.decode.push(extension);
						if (scope == 'E' || scope == 'DE')
							format.encode.push(extension);
					}
				}
				// Returns the list of supported formats
				resolve(format);
			}).catch(e => {
				reject(e)
			})
		})
	}

	/**
	 * Get the video info
	 */
	var _videoInfo = function (fileInput, settings) {
		return new Promise((resolve, reject) => {
			let tmp = `"${path.join(process.cwd(), `__fmp${new Date().getTime()}.txt`)}"`
			utils.exec(['-i', `"${fileInput}"`, '2>&1', '-f', 'ffmetadata', tmp], settings).then(stdout => {
				setTimeout(() => { if (fs.existsSync(tmp)) fs.unlink(tmp, err => { if (err) console.log(err) }) }, 3000)
				var filename = /from \'(.*)\'/.exec(stdout) || []
					, title = /(INAM|title)\s+:\s(.+)/.exec(stdout) || []
					, artist = /artist\s+:\s(.+)/.exec(stdout) || []
					, album = /album\s+:\s(.+)/.exec(stdout) || []
					, track = /track\s+:\s(.+)/.exec(stdout) || []
					, date = /date\s+:\s(.+)/.exec(stdout) || []
					, is_synched = (/start: 0.000000/.exec(stdout) !== null)
					, duration = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stdout) || []
					, container = /Input #0, ([a-zA-Z0-9]+),/.exec(stdout) || []
					, video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stdout) || []
					, video_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stdout) || []
					, video_codec = /Video: ([\w]+)/.exec(stdout) || []
					, resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stdout) || []
					, pixel = /[SP]AR ([0-9\:]+)/.exec(stdout) || []
					, aspect = /DAR ([0-9\:]+)/.exec(stdout) || []
					, fps = /([0-9\.]+) (fps|tb\(r\))/.exec(stdout) || []
					, audio_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stdout) || []
					, audio_codec = /Audio: ([\w]+)/.exec(stdout) || []
					, sample_rate = /([0-9]+) Hz/i.exec(stdout) || []
					, channels = /Audio:.* (stereo|mono)/.exec(stdout) || []
					, audio_bitrate = /Audio:.* ([0-9]+) kb\/s/.exec(stdout) || []
					, rotate = /rotate[\s]+:[\s]([\d]{2,3})/.exec(stdout) || [];
				if ((!channels || channels.length < 1) && audio_codec.includes('pcm_s24le')) {
					let strings = stdout.split('\\n')
					for (let i = 0; i < strings.length; i++) if (new RegExp('FL+FR+FC+LFE+BL+BR+DL+DR').test(strings[i])) channels = ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'DL', 'DR']
				}
				var ret = {
					filename: filename[1] || ''
					, title: title[2] || ''
					, artist: artist[1] || ''
					, album: album[1] || ''
					, track: track[1] || ''
					, date: date[1] || ''
					, synched: is_synched
					, duration: {
						raw: duration[1] || ''
						, seconds: duration[1] ? utils.durationToSeconds(duration[1]) : 0
					}
					, video: {
						container: container[1] || ''
						, bitrate: (video_bitrate.length > 1) ? parseInt(video_bitrate[1], 10) : 0
						, stream: video_stream.length > 1 ? parseFloat(video_stream[1]) : 0.0
						, codec: video_codec[1] || ''
						, resolution: {
							w: resolution.length > 2 ? parseInt(resolution[2], 10) : 0
							, h: resolution.length > 3 ? parseInt(resolution[3], 10) : 0
						}
						, resolutionSquare: {}
						, aspect: {}
						, rotate: rotate.length > 1 ? parseInt(rotate[1], 10) : 0
						, fps: fps.length > 1 ? parseFloat(fps[1]) : 0.0
					}
					, audio: {
						codec: audio_codec[1] || ''
						, bitrate: audio_bitrate[1] || ''
						, sample_rate: sample_rate.length > 1 ? parseInt(sample_rate[1], 10) : 0
						, stream: audio_stream.length > 1 ? parseFloat(audio_stream[1]) : 0.0
						, channels: (() => {
							return ({
								raw: channels[1] || ''
								, value: (channels.length > 0) ? ({ stereo: 2, mono: 1 }[channels[1]] || 0) : ''
							})
						})()
					}
				};
				if (aspect.length > 0) {
					var aspectValue = aspect[1].split(":");
					ret.video.aspect.x = parseInt(aspectValue[0], 10);
					ret.video.aspect.y = parseInt(aspectValue[1], 10);
					ret.video.aspect.string = aspect[1];
					ret.video.aspect.value = parseFloat((ret.video.aspect.x / ret.video.aspect.y));
				} else {
					if (ret.video.resolution.w > 0) {
						var gcdValue = utils.gcd(ret.video.resolution.w, ret.video.resolution.h);
						ret.video.aspect.x = ret.video.resolution.w / gcdValue;
						ret.video.aspect.y = ret.video.resolution.h / gcdValue;
						ret.video.aspect.string = ret.video.aspect.x + ':' + ret.video.aspect.y;
						ret.video.aspect.value = parseFloat((ret.video.aspect.x / ret.video.aspect.y));
					}
				}
				if (pixel.length > 0) {
					ret.video.pixelString = pixel[1];
					var pixelValue = pixel[1].split(":");
					ret.video.pixel = parseFloat((parseInt(pixelValue[0], 10) / parseInt(pixelValue[1], 10)));
				} else {
					if (ret.video.resolution.w !== 0) {
						ret.video.pixelString = '1:1';
						ret.video.pixel = 1;
					} else {
						ret.video.pixelString = '';
						ret.video.pixel = 0.0;
					}
				}
				if (ret.video.pixel !== 1 || ret.video.pixel !== 0) {
					if (ret.video.pixel > 1) {
						ret.video.resolutionSquare.w = parseInt(ret.video.resolution.w * ret.video.pixel, 10);
						ret.video.resolutionSquare.h = ret.video.resolution.h;
					} else {
						ret.video.resolutionSquare.w = ret.video.resolution.w;
						ret.video.resolutionSquare.h = parseInt(ret.video.resolution.h / ret.video.pixel, 10);
					}
				}
				resolve(ret);
			}).catch(e => {
				setTimeout(() => { if (fs.existsSync(tmp)) fs.unlink(tmp, err => { if (err) console.log(err) }) }, 3000)
				reject(e)
			})
		})
	}

	/**
	 * Get the info about ffmpeg's codec and about file
	 */
	var _getInformation = async function (fileInput, settings) {
		return Promise.all([_ffmpegInfoConfiguration(settings), _videoInfo(fileInput, settings)])
	}
	var __constructor = function (args) {
		return new Promise((res, rej) => {
			// Check if exist at least one option
			if (args.length == 0 || args[0] == undefined)
				throw errors.renderError('empty_input_filepath');
			// Check if first argument is a string
			if (typeof args[0] != 'string')
				throw errors.renderError('input_filepath_must_be_string');
			// Get the input filepath
			var inputFilepath = args[0];
			// Check if file exist
			if (!fs.existsSync(inputFilepath))
				throw errors.renderError('fileinput_not_exist');

			// New instance of the base configuration
			var settings = new configs();
			// Callback to call
			var callback = null;

			// Scan all arguments
			for (var i = 1; i < args.length; i++) {
				// Check the type of variable
				switch (typeof args[i]) {
					case 'object':
						utils.mergeObject(settings, args[i]);
						break;
					case 'function':
						callback = args[i];
						break;
				}
			}

			// Building the value for return value. Check if the callback is not a function. In this case will created a new instance of the deferred class
			return _getInformation(inputFilepath, settings).then(async data => {
				if (typeof callback == 'function') {
					// Call the callback function e return the new instance of 'video' class
					res(callback(null, new video(inputFilepath, settings, data[0], data[1])))
				} else {
					// Positive response
					return res(new video(inputFilepath, settings, data[0], data[1]))
				}
			}).catch(error => rej(error))
		})
	}

	return __constructor.call(this, arguments);
};

const genVid = (path) => {
	return new Promise((res, rej) => {
		new ffmpeg(path).then(v => res(v)).catch(e => rej(e))
	})
}
const readUrl = (url, name) => {
	return new Promise((res, rej) => {
		let tmp = './tmp/' + name
		let stream = fs.createWriteStream(tmp)
		let resolve = () => res(tmp)
		let req = https.get(url)
		req.on('response', res => res.pipe(stream))
		stream.on('finish', () => stream.close(resolve()))
		req.on('error', e => rej(e))
		stream.on('error', e => rej(e))
	})
}
const getVideo = (url) => {
	return new Promise((res, rej) => {
		let s = url.split('/')
		let a = []
		for (let i = /http/.test(url) ? 3 : 2; i < s.length; i++) a.push(s[i])
		readUrl(url, a.join('*')).then(file => res(file)).catch(e => rej(e))
	})
}
const extractSound = (p) => {
	return new Promise((res, rej) => {
		genVid(p).then(video => {
			video.fnExtractSoundToMP3(`${p}(audio${new Date().toLocaleDateString().split('/').join('')}).mp3`, (err, file) => {
				if (err) return rej(err)
				res(file)
			})
		}).catch(e => rej(e))
	})
}
const addWaterMark = (v, wm) => {
	return new Promise((res, rej) => {
		genVid(v).then(r => {
			if (!fs.existsSync('./watermarked')) fs.mkdirSync('./watermarked')
			r.fnAddWatermark(wm, `./watermarked/${path.basename(v, path.extname(v))}(watermarked)${path.extname(v)}`,
				{ position: "SW", margin_nord: null, margin_sud: null, margin_west: null, margin_east: null },  // Position: NE NC NW SE SC SW C CE CW
				(err, vid) => {
					if (err) return rej(err)
					return res(vid)
				})
		}).catch(e => rej(e))
	})
}
const extractScreenshot = (v, o) => {
	return new Promise((res, rej) => {
		genVid(v).then(r => {
			r.fnExtractFrameToJPG(o.folder, o, (err, success) => {
				if (err) return rej(err)
				res(success)
			})
		}).catch(e => rej(e))
	})
}
const renderVideo = (o) => {
	return new Promise((res, rej) => {
		genVid(o.video).then(vid => {
			let options = {force: true}
			if (vid.metadata.audio.codec === 'pcm_s24le' && o.format) options.downsample = true
			if (o.disableAudio) vid.disableAudio()
			if (o.disableVideo) vid.disableVideo()
			if (o.format) vid.setVideoFormat(o.format)
			if (o.videoCodec) vid.setVideoCodec(o.videoCodec)
			if (o.bitrate) vid.setVideoBitRate(o.bitrate)
			if (o.framerate) vid.setVideoFrameRate(o.framerate)
			if (o.startTime) vid.setVideoStartTime(o.startTime)
			if (o.duration) vid.setVideoDuration(o.duration)
			if (o.aspectRatio) vid.setVideoAspectRatio(o.aspectRatio)
			if (o.size) vid.setVideoSize(o.size, true, true, '#000')
			if (o.audioCodec) vid.setAudioCodec(o.audioCodec)
			if (o.audioFrequency) vid.setAudioFrequency(o.audioFrequency)
			if (o.audioChannels) vid.setAudioChannels(o.audioChannels)
			if (o.audioBitrate) vid.setAudioBitrate(o.audioBitrate)
			if (o.audioQuality) vid.setAudioQuality(o.audioQuality)
			if (o.setWatermark) {
				if (!o.setWatermark.settings || !o.setWatermark.path) return rej('The setWatermark option requires the watermark settings and the watermark path. (settings: {position, margin_nord margin_sud, margin_east, margin_west})')
				vid.setWatermark(o.setWatermark.path, o.setWatermark.settings)
			}
			if (o.destination) {
				vid.save(o.destination, options).then(() => {
					res(o.destination)
				}).catch(e => rej(e))
			} else {
				return rej('destination required')
			}
		}).catch(e => rej(e))
	})
}
module.exports = {
	getVideo,
	renderVideo,
	extractSound,
	extractScreenshot,
	addWaterMark,
	ffmpeg
}