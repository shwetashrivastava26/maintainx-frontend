function login(){

    let role = document.getElementById("role").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    if(
        role === "admin" &&
        username === "admin01" &&
        password === "Admin@123"
    ){
        alert("Admin Login Successful");
        window.location.href = "dashboard.html";
    }

    else if(
        role === "employee" &&
        username === "employee01" &&
        password === "Emp@123"
    ){
        alert("Employee Login Successful");
        window.location.href = "dashboard.html";
    }

    else if(
        role === "tracker" &&
        username === "tech01" &&
        password === "Tech@123"
    ){
        alert("Maintenance Tracker Login Successful");
        window.location.href = "dashboard.html";
    }

    else{
        document.getElementById("message").innerHTML =
        "Invalid Username or Password";
    }
}