var usb = exports = module.exports = require("bindings")("usb_bindings");
var events = require('events');

// convenience method for finding a device by vendor and product id
exports.findByIds = function(vid, pid) {
	var devices = usb.getDeviceList()
	
	for (var i = 0; i < devices.length; i++) {
		var deviceDesc = devices[i].deviceDescriptor
		if ((deviceDesc.idVendor == vid) && (deviceDesc.idProduct == pid)) {
			return devices[i]
		}
	}
}

usb.Device.prototype.timeout = 1000

usb.Device.prototype.open = function(){
	this.__open()
	this.interfaces = []
	var len = this.configDescriptor.interfaces.length
	for (var i=0; i<len; i++){
		this.interfaces[i] = new Interface(this, i)
	}
}

usb.Device.prototype.close = function(){
	this.__close()
	this.interfaces = null
}

Object.defineProperty(usb.Device.prototype, "configDescriptor", {
    get: function() {
        return this.configDescriptor = this.__getConfigDescriptor()
    }
});

usb.Device.prototype.controlTransfer = function(){

}

function Interface(device, id){
	this.device = device
	this.id = id
	this.altSetting = 0;
	this.__refresh()
}

Interface.prototype.__refresh = function(){
	this.descriptor = this.device.configDescriptor.interfaces[this.id][this.altSetting]
	this.endpoints = []
	var len = this.descriptor.endpoints.length
	for (var i=0; i<len; i++){
		var desc = this.descriptor.endpoints[i]
		var c = (desc.bEndpointAddress&(1 << 7) == usb.LIBUSB_ENDPOINT_IN)?InEndpoint:OutEndpoint
		this.endpoints[i] = new c(this.device, desc)
	}
}

Interface.prototype.claim = function(){
	this.device.__claimInterface(this.id)
}

Interface.prototype.release = function(cb){
	var self = this;
	this.device.__releaseInterface(this.id, function(err){
		if (!err){
			self.altSetting = 0;
			self.__refresh()
		}
		cb.call(self, err)
	})
}

Interface.prototype.setAltSetting = function(altSetting, cb){
	var self = this;
	this.device.__setInterface(this.id, altSetting, function(err){
		if (!err){
			self.altSetting = altSetting;
			self.__refresh();
		}
		cb.call(self, err)
	})

}

Interface.prototype.endpoint = function(addr){
	for (var i=0; i<this.endpoints.length; i++){
		if (this.endpoints[i].address == addr){
			return this.endpoints[i]
		}
	}
}

function Endpoint(device, descriptor){
	this.device = device
	this.descriptor = descriptor
	this.address = descriptor.bEndpointAddress
	this.transferType = descriptor.bmAttributes&0x03
}


Endpoint.prototype.startStream = function(){

}

Endpoint.prototype.stopStream = function(){

}

function InEndpoint(device, descriptor){
	Endpoint.call(this, device, descriptor)
}

exports.InEndpoint = InEndpoint
InEndpoint.prototype = Object.create(Endpoint.prototype)
InEndpoint.prototype.direction = "in"

InEndpoint.prototype.transfer = function(length, cb){
	var buffer = new Buffer(length)
	var t = new usb.Transfer(this.device)
	return t.submit(this.address, this.transferType, this.device.timeout, buffer,
		function(error, buffer, actual){
			cb.call(this, error, buffer.slice(0, actual))
		}
	)
}

function OutEndpoint(device, descriptor){
	Endpoint.call(this, device, descriptor)
}
exports.OutEndpoint = OutEndpoint
OutEndpoint.prototype = Object.create(Endpoint.prototype)
OutEndpoint.prototype.direction = "out"

OutEndpoint.prototype.transfer = function(buffer, cb){
	if (!buffer) buffer = new Buffer(0)
	else if (!Buffer.isBuffer(buffer)) buffer = new Buffer(buffer)
	var t = new usb.Transfer(this.device)
	return t.submit(this.address, this.transferType, this.device.timeout, buffer,
		function(error, buffer, actual){
			if (cb) cb.call(error)
		}
	)
}


/*
usb.OutEndpoint.prototype.startStream = function startStream(n_transfers, transfer_size){
	n_transfers = n_transfers || 3;
	transfer_size = transfer_size || this.maxPacketSize;
	this._streamTransfers = n_transfers;
	this._pendingTransfers = 0;
	for (var i=0; i<n_transfers; i++) this.emit('drain');
}

function out_ep_callback(d, err){
	//console.log("out_ep_callback", d, err, this._pendingTransfers, this._streamTransfers)
	if (err) this.emit('error', err);
	this._pendingTransfers--;
	if (this._pendingTransfers < this._streamTransfers){
		this.emit('drain');
	}
	if (this._pendingTransfers <= 0 && this._streamTransfers == 0){
		this.emit('end');
	}
}

usb.OutEndpoint.prototype.write = function write(data){
	this.transfer(data, out_ep_callback);
	this._pendingTransfers++;
}

usb.OutEndpoint.prototype.stopStream = function stopStream(){
	this._streamTransfers = 0;
	if (this._pendingTransfers == 0) this.emit('end');
}

inherits(usb.InEndpoint, events.EventEmitter);

usb.InEndpoint.prototype.startStream = function(n_transfers, transferSize){
	var self = this
	n_transfers = n_transfers || 3;
	transferSize = transferSize || this.maxPacketSize;
	
	function transferDone(data, error){
		if (!error){
			self.emit("data", data)

			if (data.length == transferSize){
				startTransfer()
			}else{
				self.emit("end")
			}
		}else{
			self.emit("error", error)
		}
	}

	function startTransfer(){
		self.transfer(transferSize, transferDone)
	}

	for (var i=0; i<n_transfers; i++){
		startTransfer()
	}
}
*/