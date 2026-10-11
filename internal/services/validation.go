package services

import (
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator is the request-DTO validator used across the API layer.
type Validator = validator.Validate

// NewValidator returns a validator using the project's tag conventions.
// Struct tags (validate:"required,email") live on request DTOs in the
// httpapi package; this is the Go counterpart of Laravel's Validator and
// intentionally keeps rules next to the data they check.
func NewValidator() *Validator {
	return validator.New()
}

// FieldErrors converts go-playground validation failures into the
// map[string][]string shape the API returns. Field names come straight
// from the struct (they match the JSON names used by the frontend).
func FieldErrors(err error) map[string][]string {
	out := map[string][]string{}
	if ve, ok := err.(validator.ValidationErrors); ok {
		for _, fe := range ve {
			field := strings.ToLower(fe.Field())
			out[field] = append(out[field], messageForTag(fe))
		}
	}
	return out
}

// messageForTag renders a human-readable message for a validation error.
// The frontend re-validates with zod for instant feedback, but the server
// remains the source of truth; these messages match the frontend copy
// where practical.
func messageForTag(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "This field is required."
	case "email":
		return "Must be a valid email address."
	case "min":
		return "Must be at least " + fe.Param() + " characters."
	case "max":
		return "Must be at most " + fe.Param() + " characters."
	case "oneof":
		return "Invalid value."
	default:
		return "Failed validation (" + fe.Tag() + ")."
	}
}
