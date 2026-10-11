// Package services contains the business-logic layer. Handlers translate
// HTTP to service calls; services own validation, persistence rules and
// domain errors. This is the Go equivalent of Laravel's "service layer /
// actions" pattern, minus the container.
package services

import "errors"

// Domain errors. Handlers map these to HTTP status codes via
// httpapi.MapError; anything else becomes a 500 and is logged.
var (
	// ErrNotFound is returned when a record does not exist.
	ErrNotFound = errors.New("not found")
	// ErrEmailTaken is returned on unique-email conflicts.
	ErrEmailTaken = errors.New("email already taken")
	// ErrInvalidCredentials is returned on bad login attempts. The
	// message is deliberately vague to avoid user enumeration.
	ErrInvalidCredentials = errors.New("invalid email or password")
	// ErrUnauthorized is returned when authentication is required or the
	// session is invalid/expired.
	ErrUnauthorized = errors.New("unauthorized")
	// ErrForbidden is returned when the authenticated user may not
	// perform the action.
	ErrForbidden = errors.New("forbidden")
	// ErrValidation is returned with field-level details (see
	// ValidationError) when input fails validation.
	ErrValidation = errors.New("validation failed")
)

// ValidationError carries field-level messages. It implements error so it
// can travel through the service layer like any other error, and handlers
// serialize it as a 422 with {"errors": {field: [messages]}}.
type ValidationError struct {
	// Fields maps a JSON field name to one or more messages.
	Fields map[string][]string
}

// Error implements the error interface.
func (e *ValidationError) Error() string {
	if len(e.Fields) == 0 {
		return ErrValidation.Error()
	}
	for field, msgs := range e.Fields {
		if len(msgs) > 0 {
			return field + ": " + msgs[0]
		}
	}
	return ErrValidation.Error()
}

// Is lets errors.Is match any ValidationError instance.
func (*ValidationError) Is(target error) bool { return target == ErrValidation }
