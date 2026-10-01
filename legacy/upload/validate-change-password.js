const validation = new JustValidate("#change-password-form");

validation
  .addField("#old-password", [
    {
      rule: "required"
    },
    {
      validator: (value) => () => {
        return fetch("verify-password.php?password=" + encodeURIComponent(value))
          .then(function (response) {
            return response.json();
          })
          .then(function (json) {
            return json.valid;
          });
      },
      errorMessage: "Invalid password"
    }
  ])
  .addField("#new-password", [
    {
      rule: "required"
    }, 
    {
      rule: "password"
    }
  ])
  .addField("#new-password-confirmation", [
    {
      rule: "required"
    },
    {
      validator: (value, fields) => {
        return value === fields["#new-password"].elem.value;
      }, 
      errorMessage: "Passwords should match"
    }
  ])
  .onSuccess(() => {
    document.getElementById("change-password-form").submit();
  })
