defmodule Delta.Config do
  # Endpoint al que se enviarán todos los deltas salientes
  def targets do
    [
      "http://delta-notifier"
    ]
  end
end
