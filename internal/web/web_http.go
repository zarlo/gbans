// Package web implements the HTTP and websocket services for the frontend client and backend server.
package web

import (
	"context"
	"crypto/tls"
	"github.com/gin-gonic/gin"
	"github.com/leighmacdonald/gbans/internal/config"
	"github.com/leighmacdonald/gbans/internal/consts"
	"github.com/leighmacdonald/gbans/internal/model"
	"github.com/leighmacdonald/gbans/internal/store"
	"github.com/leighmacdonald/steamid/v2/steamid"
	"go.uber.org/zap"
	"net/http"
	"time"
)

const ctxKeyUserProfile = "user_profile"

type Handler interface {
	ListenAndServe(context.Context) error
}

type web struct {
	app        model.Application
	logger     *zap.Logger
	httpServer *http.Server
	cm         *wsConnectionManager
}

func (web *web) ListenAndServe(ctx context.Context) error {
	web.logger.Info("Service status changed", zap.String("state", "ready"))
	defer web.logger.Info("Service status changed", zap.String("state", "stopped"))
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()
		if errShutdown := web.httpServer.Shutdown(shutdownCtx); errShutdown != nil {
			web.logger.Error("Error shutting down http service", zap.Error(errShutdown))
		}
	}()
	return web.httpServer.ListenAndServe()
}

func (web *web) bind(ctx *gin.Context, recv any) bool {
	if errBind := ctx.BindJSON(&recv); errBind != nil {
		responseErr(ctx, http.StatusBadRequest, gin.H{
			"error": "Invalid request parameters",
		})
		web.logger.Error("Invalid request", zap.Error(errBind))
		return false
	}
	return true
}

// NewWeb sets up the router and starts the API HTTP handlers
// This function blocks on the context
func NewWeb(application model.Application) (Handler, error) {
	var httpServer *http.Server
	if config.General.Mode == config.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	logger := application.Logger().Named("web")
	router := gin.New()
	router.Use(ErrorHandler(logger), gin.Recovery())

	httpServer = &http.Server{
		Addr:           config.HTTP.Addr(),
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	if config.HTTP.TLS {
		tlsVar := &tls.Config{
			// Only use curves which have assembly implementations
			CurvePreferences: []tls.CurveID{
				tls.CurveP256,
				tls.X25519, // Go 1.8 only
			},
			MinVersion: tls.VersionTLS12,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305, // Go 1.8 only
				tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,   // Go 1.8 only
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			},
		}
		httpServer.TLSConfig = tlsVar
	}
	cm := newWSConnectionManager(application.Ctx(), logger)
	webHandler := web{app: application, logger: logger, httpServer: httpServer, cm: cm}
	webHandler.setupRouter(router)
	return &webHandler, nil
}

func currentUserProfile(ctx *gin.Context) model.UserProfile {
	maybePerson, found := ctx.Get(ctxKeyUserProfile)
	if !found {
		return model.NewUserProfile(0)
	}
	person, ok := maybePerson.(model.UserProfile)
	if !ok {
		return model.NewUserProfile(0)
	}
	return person
}

// checkPrivilege first checks if the steamId matches one of the provided allowedSteamIds, otherwise it will check
// if the user has appropriate privilege levels.
// Error responses are handled by this function, no further action needs to take place in the handlers
func checkPrivilege(ctx *gin.Context, person model.UserProfile, allowedSteamIds steamid.Collection, minPrivilege store.Privilege) bool {
	for _, steamId := range allowedSteamIds {
		if steamId == person.SteamID {
			return true
		}
	}
	if person.PermissionLevel >= minPrivilege {
		return true
	}
	responseErrUser(ctx, http.StatusUnauthorized, nil, consts.ErrPermissionDenied.Error())
	return false
}