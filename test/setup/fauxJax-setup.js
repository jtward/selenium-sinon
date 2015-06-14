(function() {
	var id = 1;
	var requestQueue = [];
	var requests = {};
	
	fauxJax.install();
	fauxJax.on('request', function(request) {
		requests[id] = request;
		requestQueue.push({
			id: id,
			request: {
				body: request.requestBody,
				headers: request.requestHeaders,
				method: request.requestMethod,
				url: request.requestURL
			}
		});
		id += 1;
	});

	this.fakeServer = {
		getRequests: function() {
			var requests = JSON.stringify(requestQueue);
			requestQueue.length = 0;
			return requests;
		},
		respond: function(responses) {
			responses.forEach(function(response) {
				request = requests[response.id];
				if (request) {
					request.respond.apply(request, response.response);
					delete requests[response.id];
				}
			});
		}
	};
}());
