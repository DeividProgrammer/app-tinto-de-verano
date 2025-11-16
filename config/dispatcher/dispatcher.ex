defmodule Dispatcher do
  use Matcher
  define_accept_types [
    html: [ "text/html", "application/xhtml+html" ],
    json: [ "application/json", "application/vnd.api+json" ]
  ]

  @any %{}
  @json %{ accept: %{ json: true } }
  @html %{ accept: %{ html: true } }

  define_layers [ :static, :services, :fall_back, :not_found ]

  # === SESSION SERVICE ===
  match "/session@post", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-session:80"
  end

  match "/me@get", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-session:80"
  end

  # === GROUPS SERVICE ===
  match "/groups/:id@get", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-groups:80"
  end

  match "/groups/:id/join@post", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-groups:80"
  end

  # === COUNTER SERVICE ===
  match "/me/counter@get", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-weekly-counter:80"
  end

  match "/me/counter/increment@post", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-weekly-counter:80"
  end

  match "/me/counter/decrement@post", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-weekly-counter:80"
  end

  # === LEADERBOARD SERVICE ===
  match "/groups/:id/leaderboard@get", @json, %{ layer: :services } do
    Proxy.forward conn, [], "http://mu-leaderboard:80"
  end

  # === 404 FALLBACK ===
  match "/*_", %{ layer: :not_found } do
    send_resp( conn, 404, "Route not found.  See config/dispatcher.ex" )
  end
end
