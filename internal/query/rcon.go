// Package query implements functionality for making RCON and A2S queries
package query

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/leighmacdonald/gbans/internal/store"
	"github.com/leighmacdonald/rcon/rcon"
	"github.com/pkg/errors"
	"go.uber.org/zap"
)

// ExecRCON executes the given command against the server provided. It returns the command
// output.
func ExecRCON(ctx context.Context, addr string, password string, cmd string) (string, error) {
	execCtx, cancelExec := context.WithTimeout(ctx, time.Second*15)
	defer cancelExec()
	console, errDial := rcon.Dial(execCtx, addr, password, time.Second*10)
	if errDial != nil {
		return "", errors.Errorf("Failed to dial server: %s (%v)", addr, errDial)
	}
	resp, errExec := console.Exec(sanitizeRCONCommand(cmd))
	if errExec != nil {
		return "", errors.Errorf("Failed to exec command: %v", errExec)
	}

	return resp, nil
}

// RCON is used to execute rcon commands against multiple servers.
func RCON(ctx context.Context, logger *zap.Logger, servers []store.Server, commands ...string) map[string]string {
	responses := make(map[string]string)
	rwMutex := &sync.RWMutex{}
	timeout := time.Second * 10
	waitGroup := &sync.WaitGroup{}
	for _, server := range servers {
		waitGroup.Add(1)
		go func(server store.Server) {
			defer waitGroup.Done()
			rconCtx, cancelExec := context.WithTimeout(ctx, time.Second*20)
			defer cancelExec()
			conn, errDial := rcon.Dial(rconCtx, server.Addr(), server.RCON, timeout)
			if errDial != nil {
				logger.Error("Failed to connect to server", zap.String("name", server.ServerNameShort), zap.Error(errDial))

				return
			}
			for _, command := range commands {
				resp, errExec := conn.Exec(sanitizeRCONCommand(command))
				if errExec != nil {
					logger.Error("Failed to exec rcon command", zap.String("name", server.ServerNameShort), zap.Error(errExec))
				}
				rwMutex.Lock()
				responses[server.ServerNameShort] = resp
				rwMutex.Unlock()
			}
		}(server)
	}
	waitGroup.Wait()

	return responses
}

// sanitizeRCONCommand is a very basic check for injection of additional commands
// using `;` as a command separator. This will just return the first part of the command.
func sanitizeRCONCommand(s string) string {
	p := strings.SplitN(s, ";", 1)

	return p[0]
}
