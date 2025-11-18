defmodule Dispatcher do
  use Matcher

  define_accept_types [
    html: [ "text/html", "application/xhtml+html" ],
    json: [ "application/json", "application/vnd.api+json" ]
  ]

  @any %{}
  @json %{ accept: %{ json: true }, layer: :services }
  @html %{ accept: %{ html: true } }

  define_layers [ :services, :not_found ]

  # Auth & Sessions (semtech registration + custom session service)
  match "/accounts", @json do
    Proxy.forward conn, [], "http://registration/accounts"
  end

  match "/accounts/*path", @json do
    Proxy.forward conn, path, "http://registration/accounts/"
  end

  # Servicio de sesión simple propio
  match "/session", @json do
    Proxy.forward conn, [], "http://mu-session:80/session"
  end

  match "/me", @json do
    Proxy.forward conn, [], "http://mu-session:80/me"
  end

  # Groups - join a group (must be before /groups/:id)
  match "/groups/:id/join", @json do
    Proxy.forward conn, [], "http://mu-groups:80/groups/" <> id <> "/join"
  end

  # Groups - leave a group
  match "/groups/:id/leave", @json do
    Proxy.forward conn, [], "http://mu-groups:80/groups/" <> id <> "/leave"
  end

  # Groups - get members of a group
  match "/groups/:id/members", @json do
    Proxy.forward conn, [], "http://mu-groups:80/groups/" <> id <> "/members"
  end

  # Groups - get specific group
  match "/groups/:id", @json do
    Proxy.forward conn, [], "http://mu-groups:80/groups/" <> id
  end

  # Groups - list all groups or create new group
  match "/groups", @json do
    Proxy.forward conn, [], "http://mu-groups:80/groups"
  end

  # Counter
  match "/me/counter/*path", @json do
    Proxy.forward conn, path, "http://mu-weekly_counter:80/me/counter/"
  end

  match "/me/counter", @json do
    Proxy.forward conn, [], "http://mu-weekly_counter:80/me/counter"
  end

  # Leaderboard
  match "/groups/:id/leaderboard", @json do
    Proxy.forward conn, [], "http://mu-leaderboard:80/groups/" <> id <> "/leaderboard"
  end

  # 404
  match "/*_", %{ layer: :not_found } do
    send_resp conn, 404, "Route not found"
  end
end
