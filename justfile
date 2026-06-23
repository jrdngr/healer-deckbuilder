PORT := env_var_or_default("PORT", "8080")

# Run the dev server and open it in the browser
run:
    @( sleep 1 && open "http://localhost:{{PORT}}" ) &
    PORT={{PORT}} node server.js
